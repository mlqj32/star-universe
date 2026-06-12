import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { getLandmarks, latLonToVector3 } from './data.js';

let activeLandmark = null;
let landmarkDisplayMode = localStorage.getItem('landmarkDisplayMode') || 'click';
let landmarkFlyToken = 0;
let cameraAnimating = false;

const _planetPos = new THREE.Vector3();
const _lmPos = new THREE.Vector3();
const _lmDir = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const FACING_THRESHOLD = 0.05;

export function cancelLandmarkFly() {
  landmarkFlyToken++;
  cameraAnimating = false;
}

export function isCameraAnimating() {
  return cameraAnimating;
}

function surfaceNormal(lat, lon, radius) {
  const pos = latLonToVector3(lat, lon, radius, 1.0);
  return new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
}

function createPinMesh(normal, radius, { large = false, minor = false } = {}) {
  const group = new THREE.Group();
  const scale = large ? 1.6 : minor ? 0.72 : 1;
  const pinLen = radius * 0.09 * scale;
  const tip = normal.clone().multiplyScalar(radius * 1.004);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.02 * scale, pinLen, 10),
    new THREE.MeshBasicMaterial({ color: large ? 0xff4422 : minor ? 0xff9966 : 0xff7744 })
  );
  cone.position.copy(normal.clone().multiplyScalar(radius * 1.004 + pinLen * 0.5));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  group.add(cone);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.016 * scale, radius * 0.026 * scale, 32),
    new THREE.MeshBasicMaterial({
      color: large ? 0xffdd55 : 0xffbb44,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: large ? 1 : minor ? 0.55 : 0.75,
    })
  );
  ring.position.copy(tip);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  group.add(ring);

  if (large) {
    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.03, radius * 0.042, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      })
    );
    pulse.position.copy(tip);
    pulse.quaternion.copy(ring.quaternion);
    pulse.name = 'pulse';
    group.add(pulse);
  }

  return group;
}

function createSurfaceLabel(name, normal, radius, large = false, minor = false) {
  const div = document.createElement('div');
  div.className = large ? 'landmark-active-label' : minor ? 'landmark-surface minor' : 'landmark-surface';
  div.textContent = name;
  const label = new CSS2DObject(div);
  label.position.copy(normal.clone().multiplyScalar(radius * (large ? 1.14 : minor ? 1.05 : 1.07)));
  return label;
}

export function getLandmarkDisplayMode() {
  return landmarkDisplayMode;
}

export function isActiveLandmark(name) {
  return !!name && activeLandmark?.lm?.name === name;
}

/** 列表项点击：已选中则取消，否则飞行并标注 */
export function toggleLandmarkFromList(camera, controls, planetMesh, lm, radius) {
  if (isActiveLandmark(lm.name)) {
    cancelLandmarkFly();
    clearActiveLandmark({ keepBanner: false });
    return false;
  }
  flyToLandmark(camera, controls, planetMesh, lm, radius);
  return true;
}

export function setLandmarkDisplayMode(mode) {
  landmarkDisplayMode = mode === 'all' ? 'all' : mode === 'click' ? 'click' : 'none';
  if (landmarkDisplayMode !== 'none') {
    localStorage.setItem('landmarkDisplayMode', landmarkDisplayMode);
  }
}

/** 有地标数据但启动时未创建 mesh 时补建（如水星/金星） */
export function ensureLandmarkLabels(entry) {
  if (!entry?.mesh || entry.landmarks) return entry?.landmarks ?? null;
  const items = getLandmarks(entry.data?.id);
  if (!items.length) return null;
  entry.landmarks = createLandmarkLabels(entry.mesh, entry.data.id, entry.radius);
  return entry.landmarks;
}

export function createLandmarkLabels(planetMesh, planetId, radius) {
  const group = new THREE.Group();
  group.name = 'landmarks';
  group.visible = false;

  getLandmarks(planetId).forEach((lm) => {
    const sub = new THREE.Group();
    sub.name = `lm_${lm.name}`;
    sub.userData.landmark = lm;

    const normal = surfaceNormal(lm.lat, lm.lon, radius);
    sub.add(createPinMesh(normal, radius, { minor: !lm.major }));
    sub.add(createSurfaceLabel(lm.name, normal, radius, false, !lm.major));
    sub.visible = false;

    group.add(sub);
  });

  planetMesh.add(group);
  return group;
}

/** 地标是否处在朝向相机的半球（CSS2D 无深度测试，背面须手动剔除） */
function isLandmarkFacing(lm, planetMesh, camera) {
  if (!lm || !planetMesh || !camera) return false;
  planetMesh.updateWorldMatrix(true, false);
  const planetPos = planetMesh.getWorldPosition(_planetPos);
  const local = latLonToVector3(lm.lat, lm.lon, 1, 1.0);
  _lmPos.set(local.x, local.y, local.z).applyMatrix4(planetMesh.matrixWorld);
  _lmDir.copy(_lmPos).sub(planetPos).normalize();
  _toCam.copy(camera.position).sub(_lmPos).normalize();
  return _lmDir.dot(_toCam) > FACING_THRESHOLD;
}

/** 仅显示朝向相机半球的地标 */
function updateLandmarkFacing(landmarkGroup, planetMesh, camera) {
  if (!landmarkGroup || !planetMesh || !camera) return;
  landmarkGroup.children.forEach((sub) => {
    const lm = sub.userData.landmark;
    if (!lm) return;
    const facing = isLandmarkFacing(lm, planetMesh, camera);
    sub.visible = facing;
    sub.children.forEach((child) => {
      if (child.element?.classList?.contains('landmark-surface')) {
        child.element.style.display = facing ? '' : 'none';
      }
    });
  });
}

/** 选中地标随视角显隐：切到背面半球时隐藏，转回来再显示 */
function updateActiveLandmarkFacing(planetMesh, camera) {
  if (!activeLandmark?.group || activeLandmark.planetMesh !== planetMesh) return;
  const facing = isLandmarkFacing(activeLandmark.lm, planetMesh, camera);
  activeLandmark.group.visible = facing;
  activeLandmark.group.traverse((child) => {
    if (child.element) child.element.style.display = facing ? '' : 'none';
  });
  if (facing) {
    updateActiveLandmarkBanner(activeLandmark.lm.name);
    const pulse = activeLandmark.group.getObjectByName('pulse');
    if (pulse) {
      pulse.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.15);
    }
  } else {
    updateActiveLandmarkBanner(null);
  }
}

export function applyLandmarkDisplayMode(landmarkGroup, mode = landmarkDisplayMode, planetMesh, camera) {
  if (!landmarkGroup) return;
  if (mode === 'none') {
    hideLandmarkMarkers(landmarkGroup);
    updateLandmarkVisibility(landmarkGroup, false);
    return;
  }
  updateLandmarkVisibility(landmarkGroup, true);
  if (mode === 'all') {
    updateLandmarkFacing(landmarkGroup, planetMesh, camera);
  } else {
    hideLandmarkMarkers(landmarkGroup);
  }
}

/** 聚焦行星时同步地标组与当前显示模式（避免动画/切换竞态导致突然消失） */
export function syncFocusedLandmarks(entry, mode = landmarkDisplayMode, camera) {
  if (!entry?.landmarks) return;
  applyLandmarkDisplayMode(entry.landmarks, mode, entry.mesh, camera);
}

export function setActiveLandmark(planetMesh, lm, radius) {
  clearActiveLandmark({ keepBanner: false });

  const group = new THREE.Group();
  group.name = 'activeLandmark';
  const normal = surfaceNormal(lm.lat, lm.lon, radius);

  group.add(createPinMesh(normal, radius, { large: true }));
  group.add(createSurfaceLabel(lm.name, normal, radius, true));

  planetMesh.add(group);
  activeLandmark = { group, planetMesh, lm };

  const landmarks = planetMesh.getObjectByName('landmarks');
  if (landmarks && landmarkDisplayMode === 'click') {
    hideLandmarkMarkers(landmarks);
  }

  highlightLandmarkListItem(lm.name);
  updateActiveLandmarkBanner(lm.name);
}

export function clearActiveLandmark({ keepBanner = false } = {}) {
  if (activeLandmark?.group) {
    activeLandmark.planetMesh.remove(activeLandmark.group);
    activeLandmark.group.traverse((c) => {
      if (c.element) c.element.remove();
    });
    const landmarks = activeLandmark.planetMesh.getObjectByName('landmarks');
    if (landmarks && landmarkDisplayMode !== 'all') {
      hideLandmarkMarkers(landmarks);
    }
  }
  activeLandmark = null;
  highlightLandmarkListItem(null);
  if (!keepBanner) updateActiveLandmarkBanner(null);
}

/** 切换星球或退出聚焦时：清除所有地标 UI 与 3D 标记 */
export function resetLandmarkState(planets) {
  clearActiveLandmark();
  const hint = document.getElementById('landmark-hint');
  if (hint) {
    hint.textContent = '';
    hint.classList.add('hidden');
  }
  updateActiveLandmarkBanner(null);
  planets.forEach((entry) => {
    const stale = entry.mesh?.getObjectByName('activeLandmark');
    if (stale) {
      entry.mesh.remove(stale);
      stale.traverse((c) => {
        if (c.element) c.element.remove();
      });
    }
    if (!entry.landmarks) return;
    updateLandmarkVisibility(entry.landmarks, false);
    hideLandmarkMarkers(entry.landmarks);
  });
}

export function updateLandmarkVisibility(landmarkGroup, show) {
  if (landmarkGroup) landmarkGroup.visible = show;
}

export function hideLandmarkMarkers(landmarkGroup) {
  landmarkGroup?.children.forEach((sub) => {
    sub.visible = false;
  });
}

export function updateLandmarksByDistance(landmarkGroup, cameraDist, radius, planetMesh, camera) {
  if (landmarkDisplayMode !== 'none' && landmarkGroup?.visible) {
    if (landmarkDisplayMode === 'all') {
      updateLandmarkFacing(landmarkGroup, planetMesh, camera);
    } else {
      const showLabels = cameraDist < radius * 12;
      landmarkGroup.children.forEach((sub) => {
        if (!sub.visible) return;
        sub.children.forEach((child) => {
          if (child.element?.classList.contains('landmark-surface')) {
            child.element.style.display = showLabels ? '' : 'none';
          }
        });
      });
    }
  }

  updateActiveLandmarkFacing(planetMesh, camera);
}

export function flyToLandmark(camera, controls, planetMesh, lm, radius, duration = 1.2) {
  setActiveLandmark(planetMesh, lm, radius);

  const pos = latLonToVector3(lm.lat, lm.lon, radius, 1.0);
  const worldPos = new THREE.Vector3(pos.x, pos.y, pos.z);
  planetMesh.localToWorld(worldPos);

  const normal = worldPos.clone().sub(planetMesh.getWorldPosition(new THREE.Vector3())).normalize();
  const camDist = Math.max(radius * 4, radius / Math.sin((28 * Math.PI) / 180) * 1.2);
  const targetCam = worldPos.clone().add(normal.multiplyScalar(camDist));

  return animateCamera(camera, controls, targetCam, worldPos, duration);
}

function updateActiveLandmarkBanner(name) {
  const hint = document.getElementById('landmark-hint');
  if (!hint) return;
  if (name) {
    hint.textContent = name;
    hint.classList.remove('hidden');
  } else {
    hint.textContent = '';
    hint.classList.add('hidden');
  }
}

function updateLandmarkModeTip(mode) {
  const tip = document.getElementById('landmark-mode-tip');
  if (!tip) return;
  tip.textContent =
    mode === 'all'
      ? '全部显示：球面已标注所有地标，点击列表可飞行抵达'
      : mode === 'click'
        ? '点击显示：点击列表中的地名，在球面显示标记并飞行抵达'
        : '地标标注已关闭，再次点击模式按钮可重新开启';
}

export function bindLandmarkModeToggle(onChange) {
  const buttons = document.querySelectorAll('.landmark-mode-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === landmarkDisplayMode);
    btn.onclick = () => {
      const mode = btn.dataset.mode;
      if (btn.classList.contains('active')) {
        setLandmarkDisplayMode('none');
        buttons.forEach((b) => b.classList.remove('active'));
        clearActiveLandmark({ keepBanner: false });
        updateLandmarkModeTip('none');
        onChange('none');
        return;
      }
      setLandmarkDisplayMode(mode);
      buttons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
      if (mode === 'click') clearActiveLandmark({ keepBanner: false });
      updateLandmarkModeTip(mode);
      onChange(mode);
    };
  });
  updateLandmarkModeTip(landmarkDisplayMode);
  onChange(landmarkDisplayMode);
}

function highlightLandmarkListItem(name) {
  document.querySelectorAll('#landmark-list li').forEach((li) => {
    li.classList.toggle('active', name && li.textContent === name);
  });
}

function animateCamera(camera, controls, targetPos, lookAt, duration) {
  const flyId = ++landmarkFlyToken;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = performance.now();
  cameraAnimating = true;
  controls.enabled = false;

  return new Promise((resolve) => {
    function finish() {
      cameraAnimating = false;
      controls.enabled = true;
      resolve();
    }
    function step() {
      if (flyId !== landmarkFlyToken) {
        finish();
        return;
      }
      const t = Math.min((performance.now() - startTime) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, lookAt, ease);
      if (t < 1) requestAnimationFrame(step);
      else finish();
    }
    step();
  });
}

export function populateLandmarkList(planetId, onSelect) {
  const list = document.getElementById('landmark-list');
  list.innerHTML = '';
  getLandmarks(planetId).forEach((lm) => {
    const li = document.createElement('li');
    li.textContent = lm.name;
    if (lm.major) li.classList.add('major');
    li.addEventListener('click', () => onSelect(lm));
    list.appendChild(li);
  });
}
