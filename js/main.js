import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  PLANETS,
  DISTANCE_PER_AU,
  TEXTURE_BASE,
  visualRadius,
  orbitDistance,
  getLandmarks,
} from './data.js';
import {
  createStarfield,
  createSunGlow,
  createSunSurfaceMaterial,
  setSunGlowLevel,
  updateSunEffects,
  createOrbitRing,
  createEllipseOrbitRing,
  alignOrbitRingToPlanet,
  alignOrbitRingToAngle,
  ORBIT_OPACITY,
  updateOrbitLineResolution,
  createKuiperBelt,
  createSaturnRings,
  applySaturnRingTexture,
  setupPostProcessing,
  createSunLight,
  createAmbientFill,
  createHemisphereLight,
  createFocusFillLight,
  updateExoStarGlow,
} from './effects.js';
import {
  createLandmarkLabels,
  ensureLandmarkLabels,
  updateLandmarkVisibility,
  updateLandmarksByDistance,
  clearActiveLandmark,
  resetLandmarkState,
  flyToLandmark,
  populateLandmarkList,
  bindLandmarkModeToggle,
  getLandmarkDisplayMode,
  syncFocusedLandmarks,
  hideLandmarkMarkers,
  cancelLandmarkFly,
  toggleLandmarkFromList,
  isCameraAnimating,
} from './landmarks.js';
import {
  createCosmos,
  setCosmosVisibility,
  syncMilkyWayView,
  VIEW_MODES,
  UNIVERSE_NAV_ITEMS,
  getCosmicItem,
  getCosmicNavItems,
  collectCosmicPickTargets,
} from './cosmos.js';
import {
  STAR_SYSTEMS,
  SOL_GALAXY_POS,
  getStarSystem,
  buildGalacticStarSystems,
  applyExoSystemPositions,
  setExoSystemsVisible,
  hideAllExoSystems,
  createGalaxyOverviewMarkers,
  rebuildRegionOverview,
  getRegionOverviewCamera,
  getStarSystemCamera,
  getSystemFrameRadius,
  setExoOrbitRingsVisible,
} from './starSystems.js';
import {
  getCosmicRegion,
  getRegionByNavItem,
  getRegionSystems,
  getSystemWorldPos,
  formatSystemDistance,
} from './cosmicRegions.js';
import { getExoProfile, getExoDesc } from './exoProfiles.js';
import {
  createProceduralTexture,
  createProceduralSunTexture,
  createProceduralSaturnRingTexture,
  generateNormalFromDiffuse,
} from './textures.js';
import { getPlanetTextureConfig } from './planetTextures.js';
import {
  ORBITAL_ELEMENTS,
  getHeliocentricPosition,
  getEllipticOrbitPosition,
  getMoonOrbitAngle,
  getEarthMeshRotation,
  getAxialSpinAngle,
  formatSimTime,
} from './astroTime.js';
import { readViewState, writeViewState } from './viewState.js';

/* ─── State ─── */
const state = {
  focus: null,
  viewMode: 'solar',
  activeStarSystem: null,
  planets: new Map(),
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  loading: { total: 0, done: 0 },
  animating: false,
  activeCosmicId: null,
  activeRegion: null,
  regionEnteredFrom: 'topnav',
  regionParent: null,
  roamingSystemId: null,
};

let cosmos = null;
let exoSystems = new Map();
let galaxyOverview = null;
let focusToken = 0;
let flyToken = 0;
let cameraFlyToken = 0;
const focusTargetScratch = new THREE.Vector3();

let viewSaveEnabled = false;
let saveViewTimer = null;
let pendingViewRestore = readViewState();

function collectViewState() {
  return {
    viewMode: state.viewMode,
    focus: state.focus,
    inFocusMode: document.body.classList.contains('focus-mode'),
    camera: camera.position.toArray(),
    target: controls.target.toArray(),
    activeStarSystem: state.activeStarSystem,
    roamingSystemId: state.roamingSystemId,
    activeRegion: state.activeRegion,
    activeCosmicId: state.activeCosmicId,
    regionEnteredFrom: state.regionEnteredFrom,
    regionParent: state.regionParent,
  };
}

/** 立即写入（导航切换等），不等待相机动画结束 */
function writeViewStateSnapshot() {
  if (!bootReady) return;
  writeViewState(collectViewState());
}

function saveViewStateNow() {
  if (!viewSaveEnabled || !bootReady) return;
  if (state.animating || isCameraAnimating()) return;
  writeViewStateSnapshot();
}

function scheduleSaveViewState() {
  if (!viewSaveEnabled) return;
  if (saveViewTimer) clearTimeout(saveViewTimer);
  saveViewTimer = setTimeout(saveViewStateNow, 450);
}

function persistViewStateOnExit() {
  if (saveViewTimer) {
    clearTimeout(saveViewTimer);
    saveViewTimer = null;
  }
  writeViewStateSnapshot();
}

function applySolarViewShell() {
  state.viewMode = 'solar';
  state.activeStarSystem = null;
  state.roamingSystemId = null;
  state.activeCosmicId = null;
  state.activeRegion = null;
  markPickMeshesDirty();
  document.body.classList.remove('universe-mode', 'region-mode');
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === 'solar');
  });
  hideAllExoSystems(exoSystems);
  if (galaxyOverview) galaxyOverview.visible = false;
  positionSolarGroupForMode();
  solarGroup.visible = true;
  const cfg = VIEW_MODES.solar;
  controls.maxDistance = cfg.camMax;
  camera.far = cfg.far;
  camera.updateProjectionMatrix();
  updateGalaxyBackdrop();
  updateLeftNav();
  const scaleInfo = document.getElementById('scale-info');
  if (scaleInfo) {
    scaleInfo.textContent =
      '距离比例：1 AU = 80 单位 · 椭圆轨道 + J2000 根数实时推算';
  }
}

function applyPlanetFocusState(id, saved) {
  const entry = state.planets.get(id);
  if (!entry) return false;

  clearActiveLandmark();
  state.focus = id;
  markPickMeshesDirty();
  document.body.classList.add('focus-mode');
  if (!bootUiLocked) {
    document.getElementById('btn-back')?.classList.remove('hidden');
    document.getElementById('hud-right')?.classList.remove('hidden');
  }

  applyPlanetFocusLighting(id, entry.data);
  setSunGlowLevel(getSunEntry()?.mesh?.userData?.glow, id === 'sun' ? 'full' : 'dim');
  setSolarOrbitRingsVisible(true, 'focus', id);

  if (entry.data.isMoon && entry.ring) {
    alignOrbitRingToAngle(entry.ring, entry.dist, getMoonOrbitAngle(new Date()));
  } else if (!entry.data.orbitParent && !entry.data.isStar) {
    const pos = getHeliocentricPosition(id, new Date(), DISTANCE_PER_AU);
    syncFocusedOrbitRing(entry, pos);
  }

  controls.enablePan = false;
  controls.rotateSpeed = 1.15;
  controls.dampingFactor = 0.04;
  controls.minDistance = getFocusMinDist(id, entry.radius);
  controls.maxDistance = getFocusMaxDist(entry.radius);

  if (saved?.camera) camera.position.fromArray(saved.camera);
  if (saved?.target) controls.target.fromArray(saved.target);
  controls.update();

  document.querySelectorAll('#planet-list li').forEach((li) => {
    li.classList.toggle('active', li.dataset.id === id);
  });

  ensureLandmarkLabels(entry);
  ensurePlanetTextures(entry);
  reapplyCachedTextures(entry);
  setPlanetVisualMode(id);
  syncFocusedLandmarks(entry, getLandmarkDisplayMode(), camera);
  if (!bootUiLocked) showFocusPanel(entry);
  return true;
}

function restoreSolarView(saved) {
  applySolarViewShell();
  applyAstroPositions(new Date());

  if (saved.inFocusMode && saved.focus && !String(saved.focus).includes(':')) {
    if (!applyPlanetFocusState(saved.focus, saved)) {
      camera.position.fromArray(saved.camera);
      controls.target.fromArray(saved.target);
      controls.update();
      setSolarOrbitRingsVisible(true, 'roam');
      applySolarBloom('roam');
      document.getElementById('btn-back')?.classList.add('hidden');
    }
    return;
  }

  state.focus = null;
  document.body.classList.remove('focus-mode');
  camera.position.fromArray(saved.camera);
  controls.target.fromArray(saved.target);
  controls.update();
  setSolarOrbitRingsVisible(true, 'roam');
  applySolarBloom('roam');
  setSunGlowLevel(getSunEntry()?.mesh?.userData?.glow, 'roam');
  document.getElementById('btn-back')?.classList.add('hidden');
  document.getElementById('hud-right')?.classList.add('hidden');
  setPlanetVisualMode(null);
  applySolarRoamLighting(true);
}

function applyRestoredExoCamera(saved, sys, worldPos, maxDist) {
  const frame = getSystemFrameRadius(sys, DISTANCE_PER_AU);
  const minDist = Math.max(frame * 0.1, 1.4);
  const maxAllowed = maxDist * 0.92;
  const fallback = getStarSystemCamera(sys, DISTANCE_PER_AU);

  controls.target.fromArray(saved.target);
  camera.position.fromArray(saved.camera);

  if (worldPos && controls.target.distanceTo(worldPos) > frame * 2.5) {
    controls.target.copy(worldPos);
  }

  const offset = camera.position.clone().sub(controls.target);
  let dist = offset.length();
  if (!Number.isFinite(dist) || dist < minDist || dist > maxAllowed) {
    camera.position.copy(fallback.camPos);
    controls.target.copy(fallback.worldPos);
  } else {
    offset.normalize().multiplyScalar(Math.max(minDist, Math.min(dist, maxAllowed)));
    camera.position.copy(controls.target).add(offset);
  }

  controls.maxDistance = maxDist;
  controls.minDistance = Math.min(0.5, minDist * 0.35);
  controls.update();
}

function restoreExtendedView(saved) {
  state.viewMode = saved.viewMode;
  state.activeRegion = saved.activeRegion ?? (saved.viewMode === 'galaxy' ? 'milkyway' : null);
  state.activeCosmicId = saved.activeCosmicId ?? null;
  state.regionEnteredFrom = saved.regionEnteredFrom ?? 'topnav';
  state.regionParent = saved.regionParent ?? null;
  state.activeStarSystem = saved.activeStarSystem ?? null;
  state.roamingSystemId = saved.roamingSystemId ?? null;
  state.focus = null;

  document.body.classList.remove('focus-mode');
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === saved.viewMode);
  });
  document.body.classList.toggle('universe-mode', saved.viewMode === 'universe');
  document.body.classList.toggle(
    'region-mode',
    saved.viewMode === 'galaxy' && state.activeRegion !== 'milkyway'
  );

  hideAllExoSystems(exoSystems);
  solarGroup.visible = false;
  if (galaxyOverview) {
    rebuildRegionOverview(galaxyOverview, state.activeRegion || 'milkyway');
    galaxyOverview.visible =
      saved.viewMode === 'galaxy' &&
      !state.activeStarSystem &&
      !state.roamingSystemId;
  }
  if (saved.viewMode === 'universe' && galaxyOverview) {
    galaxyOverview.visible = false;
  }

  const cfg = VIEW_MODES[saved.viewMode] ?? VIEW_MODES.galaxy;
  controls.maxDistance = cfg.camMax;
  camera.far = cfg.far;
  camera.near = 0.1;
  camera.updateProjectionMatrix();
  document.getElementById('btn-back')?.classList.remove('hidden');
  document.getElementById('hud-right')?.classList.add('hidden');

  if (saved.activeStarSystem === 'sol') {
    restoreSolarView(saved);
    updateGalaxyBackdrop();
    updateLeftNav();
    markPickMeshesDirty();
    return;
  }

  const localSystemId = saved.activeStarSystem || saved.roamingSystemId;
  if (localSystemId && localSystemId !== 'sol') {
    const sys = getStarSystem(localSystemId);
    if (sys) {
      const { worldPos, maxDist } = prepareStarSystemScene(localSystemId, sys);
      applyExoSystemPositions(exoSystems, new Date(), DISTANCE_PER_AU);
      applyRestoredExoCamera(saved, sys, worldPos, maxDist);
      bloom.strength = 0.4;
      bloom.threshold = 0.9;

      if (
        saved.inFocusMode &&
        saved.focus?.includes(':') &&
        saved.focus.startsWith(`${localSystemId}:`)
      ) {
        const planetId = saved.focus.split(':')[1];
        const entry = exoSystems.get(localSystemId)?.planets.get(planetId);
        if (entry) {
          state.focus = saved.focus;
          document.body.classList.add('focus-mode');
          focusFillLight.intensity = 0.34;
          hemiLight.intensity = 0.24;
          ambientLight.intensity = 0.18;
          bloom.strength = 0.22;
          bloom.threshold = 0.92;
          controls.enablePan = false;
          controls.minDistance = getFocusMinDist(planetId, entry.radius);
          controls.maxDistance = getFocusMaxDist(entry.radius);
          setExoOrbitRingsVisible(exoSystems, localSystemId, planetId);
          showExoFocusPanel(sys, entry.data, entry);
        }
      }
      updateGalaxyBackdrop();
      updateLeftNav();
      markPickMeshesDirty();
      return;
    }
  }

  camera.position.fromArray(saved.camera);
  controls.target.fromArray(saved.target);
  controls.update();
  updateGalaxyBackdrop();
  updateLeftNav();
  markPickMeshesDirty();
}

function restoreSavedView() {
  const saved = pendingViewRestore;
  pendingViewRestore = null;
  if (!saved) {
    viewSaveEnabled = true;
    return Promise.resolve();
  }

  viewSaveEnabled = false;

  if (saved.viewMode === 'solar' && !saved.activeStarSystem) {
    restoreSolarView(saved);
    viewSaveEnabled = true;
    scheduleSaveViewState();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    scheduleGalaxyInit(() => {
      restoreExtendedView(saved);
      viewSaveEnabled = true;
      scheduleSaveViewState();
      resolve();
    });
  });
}

/* ─── Core setup ─── */
const canvas = document.getElementById('universe');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 50000);
camera.position.set(0, 180, 320);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const DEFAULT_TONE_EXPOSURE = 1.12;
const ROAM_LIGHT = { sun: 6.5, amb: 0.15, hemi: 0.22 };
const _sunWorldPos = new THREE.Vector3();
let lastRoamLightDist = -1;
renderer.toneMappingExposure = DEFAULT_TONE_EXPOSURE;
renderer.sortObjects = true;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
labelRenderer.domElement.classList.add('label-layer');
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = 55000;
controls.rotateSpeed = 1.1;
controls.zoomSpeed = 1.5;
controls.panSpeed = 1.2;
controls.screenSpacePanning = true;

function cancelCameraAnimations() {
  cameraFlyToken++;
  cancelLandmarkFly();
  state.animating = false;
}

let viewDragging = false;

controls.addEventListener('start', () => {
  viewDragging = true;
  hideHoverTooltip();
  cancelCameraAnimations();
  setTextureUpgradePaused(true);
});
controls.addEventListener('end', () => {
  viewDragging = false;
  setTimeout(() => setTextureUpgradePaused(false), 800);
  scheduleSaveViewState();
  hoverPickRaf = requestAnimationFrame(runHoverPick);
});

const { composer, bloom } = setupPostProcessing(renderer, scene, camera);
scene.add(createStarfield(4500));
const ambientLight = createAmbientFill();
const hemiLight = createHemisphereLight();
scene.add(ambientLight);
scene.add(hemiLight);

const sunLight = createSunLight();

const focusFillLight = createFocusFillLight();
camera.add(focusFillLight);
scene.add(camera);

const solarGroup = new THREE.Group();
solarGroup.name = 'solarSystem';
scene.add(solarGroup);

cosmos = createCosmos();
scene.add(cosmos.group);

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

function trackLoad() {
  state.loading.total++;
  return () => {
    state.loading.done++;
  };
}

const bootStartedAt = performance.now();
const BOOT_MIN_MS = 1600;
const BOOT_MIN_FRAMES = 10;
const BOOT_MAX_MS = 20000;
let bootReady = false;
let bootDismissed = false;
let bootRenderedFrames = 0;
let sceneBusyActive = false;
let bootUiLocked = true;

document.body.classList.add('booting');

function setLoadScreen(pct, status) {
  const label = document.querySelector('#loading p');
  const progress = document.getElementById('load-progress');
  if (label && status) label.textContent = status;
  if (progress && pct != null) {
    progress.textContent = `${Math.min(100, Math.max(0, pct))}%`;
  }
}

function hideLoading() {
  if (sceneBusyActive) return;
  document.getElementById('loading')?.classList.add('hidden');
}

function showSceneBusy(status) {
  const loading = document.getElementById('loading');
  if (!loading) return;
  sceneBusyActive = true;
  loading.classList.remove('hidden');
  loading.classList.add('scene-busy');
  setLoadScreen(null, status);
}

function hideSceneBusy() {
  const loading = document.getElementById('loading');
  if (!loading || !sceneBusyActive) return;
  sceneBusyActive = false;
  loading.classList.remove('scene-busy');
  if (bootDismissed) hideLoading();
}

function isFocusVisualReady() {
  if (!state.focus || String(state.focus).includes(':')) return true;
  const entry = state.planets.get(state.focus);
  if (!entry) return true;
  if (entry.data.isStar) return true;
  const mat = entry.mesh?.material;
  return !!(mat?.map || mat?.uniforms?.uMap);
}

function isCanvasSceneReady() {
  if (!isFocusVisualReady()) return false;
  try {
    const gl = renderer.getContext();
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    if (w < 2 || h < 2) return false;
    const buf = new Uint8Array(4);
    const samples = [
      [0.5, 0.5],
      [0.38, 0.42],
      [0.62, 0.58],
      [0.5, 0.32],
      [0.5, 0.68],
    ];
    for (const [ux, uy] of samples) {
      gl.readPixels(
        Math.floor(w * ux),
        Math.floor(h * uy),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        buf
      );
      if (buf[0] + buf[1] + buf[2] > 18) return true;
    }
    return false;
  } catch {
    return bootRenderedFrames >= BOOT_MIN_FRAMES;
  }
}

function flushBootUi() {
  bootUiLocked = false;
  if (!state.focus) {
    updateLeftNav();
    return;
  }
  document.getElementById('btn-back')?.classList.remove('hidden');
  if (String(state.focus).includes(':')) {
    const [sid, pid] = state.focus.split(':');
    const exoEntry = exoSystems.get(sid)?.planets.get(pid);
    const sys = getStarSystem(sid);
    if (exoEntry && sys) showExoFocusPanel(sys, exoEntry.data, exoEntry);
  } else {
    const entry = state.planets.get(state.focus);
    if (entry) showFocusPanel(entry);
  }
  updateLeftNav();
}

function dismissBootScreen() {
  if (bootDismissed) return;
  bootDismissed = true;
  setLoadScreen(100, '欢迎进入 Star宇宙');
  flushBootUi();
  document.body.classList.remove('booting');
  document.body.classList.add('boot-ready');
  if (!sceneBusyActive) hideLoading();
}

function tryDismissLoading() {
  if (bootDismissed || !bootReady) return;
  if (bootRenderedFrames < BOOT_MIN_FRAMES) return;
  if (performance.now() - bootStartedAt < BOOT_MIN_MS) return;
  if (!isCanvasSceneReady()) return;
  dismissBootScreen();
}

setLoadScreen(0, '正在载入宇宙…');

setTimeout(() => {
  if (bootDismissed) return;
  if (!bootReady) {
    setLoadScreen(92, '仍在初始化，请稍候…');
    return;
  }
  if (bootRenderedFrames >= BOOT_MIN_FRAMES && isCanvasSceneReady()) {
    dismissBootScreen();
  }
}, BOOT_MAX_MS);

function enhanceTexture(tex) {
  if (!tex) return null;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function enhanceNormalTexture(tex) {
  if (!tex) return null;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function loadTextureOnce(url, timeoutMs = 3000, track = false) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const done = track ? trackLoad() : () => {};
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        done();
        resolve(null);
      }
    }, timeoutMs);

    textureLoader.load(
      url,
      (tex) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        done();
        resolve(tex);
      },
      undefined,
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        done();
        resolve(null);
      }
    );
  });
}

/** 并行竞速多源纹理，先返回成功者 */
function loadTextureChain(urls, { srgb = true, timeoutMs = 3000 } = {}) {
  if (!urls?.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    let remaining = urls.length;
    const finish = (raw) => {
      if (settled) return;
      settled = true;
      resolve(
        raw ? (srgb ? enhanceTexture(raw) : enhanceNormalTexture(raw)) : null
      );
    };
    urls.forEach((url) => {
      loadTextureOnce(url, timeoutMs, false).then((raw) => {
        if (!settled && raw) finish(raw);
        else if (--remaining === 0 && !settled) finish(null);
      });
    });
  });
}

const textureUpgradeQueue = [];
let textureUpgradeActive = 0;
const TEXTURE_UPGRADE_CONCURRENCY = 3;
let textureUpgradePaused = false;
let textureUpgradeDelayTimer = null;

function getInstantTextures(planetId) {
  const planet = PLANETS.find((p) => p.id === planetId);
  return {
    map: null,
    color: planet?.color ?? '#888888',
    bump: null,
    normalScale: 0.4,
    roughness: 0.82,
  };
}

function scheduleNormalMapForPlanet(planetId, map, cfg) {
  if (textureUpgradePaused) return;
  const run = () => {
    if (textureUpgradePaused) return;
    const entry = state.planets.get(planetId);
    if (!entry?.mesh?.material) return;
    const bump = enhanceNormalTexture(
      generateNormalFromDiffuse(map, (cfg.normalScale ?? 0.35) * 2.4)
    );
    if (!bump) return;
    applyNormalMap(entry.mesh.material, {
      bump,
      normalScale: cfg.normalScale ?? 0.4,
      generatedNormal: true,
    });
    entry.mesh.material.needsUpdate = true;
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 12000 });
  } else {
    setTimeout(run, 2000);
  }
}

/** 加载真实行星纹理（后台升级，不阻塞首屏） */
async function loadPlanetTextures(planetId) {
  const cfg = getPlanetTextureConfig(planetId);
  if (!cfg) return getInstantTextures(planetId);

  const map = await loadTextureChain(cfg.map, {
    timeoutMs: ['uranus', 'neptune', 'saturn', 'jupiter'].includes(planetId) ? 6000 : 3500,
  });
  let bump = null;
  if (cfg.normal?.length) {
    bump = await loadTextureChain(cfg.normal, { srgb: false, timeoutMs: 3500 });
  }

  if (!map) {
    const procedural =
      planetId !== 'sun' && planetId !== 'earth' ? createProceduralTexture(planetId) : null;
    if (procedural) {
      return {
        map: procedural,
        bump: null,
        normalScale: cfg.normalScale ?? 0.4,
        roughness: cfg.roughness ?? 0.72,
        generatedNormal: false,
      };
    }
    return getInstantTextures(planetId);
  }

  if (!bump && cfg.generateNormal !== false && !textureUpgradePaused) {
    scheduleNormalMapForPlanet(planetId, map, cfg);
  }

  return {
    map,
    bump,
    normalScale: cfg.normalScale ?? 0.4,
    roughness: cfg.roughness ?? 0.82,
    generatedNormal: false,
  };
}

function applyTexturesToPlanet(entry, textures) {
  const { data, mesh } = entry;
  if (!mesh?.material || data.isStar) return;
  const mat = mesh.material;
  const prev = entry._appliedTextures;
  const merged = {
    map: textures.map ?? prev?.map ?? null,
    bump: textures.bump ?? prev?.bump ?? null,
    normalScale: textures.normalScale ?? prev?.normalScale ?? 0.4,
    roughness: textures.roughness ?? prev?.roughness ?? 0.82,
    generatedNormal: textures.generatedNormal ?? prev?.generatedNormal ?? false,
  };
  if (merged.map) {
    mat.map = merged.map;
    mat.color.set(0xffffff);
    if (merged.roughness !== undefined) mat.roughness = merged.roughness;
    entry._appliedTextures = merged;
    entry._hdTextureApplied = merged.map.isCanvasTexture !== true;
  } else if (merged.bump) {
    entry._appliedTextures = merged;
  }
  applyNormalMap(mat, merged);
  mat.needsUpdate = true;
}

function reapplyCachedTextures(entry) {
  if (!entry?._appliedTextures?.map || !entry.mesh?.material || entry.data.isStar) {
    return false;
  }
  const mat = entry.mesh.material;
  if (mat.map === entry._appliedTextures.map && mat.normalMap === entry._appliedTextures.bump) {
    return true;
  }
  applyTexturesToPlanet(entry, entry._appliedTextures);
  return true;
}

function prioritizeTextureUpgrade(entry) {
  if (!entry || entry.data.isStar || entry._textureUpgrading) return;
  const idx = textureUpgradeQueue.indexOf(entry);
  if (idx >= 0) textureUpgradeQueue.splice(idx, 1);
  textureUpgradeQueue.unshift(entry);
  entry._textureQueued = true;
  if (textureUpgradeDelayTimer) {
    clearTimeout(textureUpgradeDelayTimer);
    textureUpgradeDelayTimer = null;
  }
  drainTextureUpgradeQueue();
}

function ensurePlanetTextures(entry) {
  if (!entry || entry.data.isStar) return;
  reapplyCachedTextures(entry);
  if (!entry._hdTextureApplied && getPlanetTextureConfig(entry.data.id)) {
    prioritizeTextureUpgrade(entry);
  }
}

async function upgradePlanetTextures(entry) {
  const { data, mesh, radius } = entry;
  if (data.isStar) {
    try {
      await upgradeSunTexture(entry);
    } catch (err) {
      console.warn('太阳纹理加载失败:', err);
    }
    return;
  }
  if (entry._textureUpgrading) return;
  entry._textureUpgrading = true;
  try {
    const textures = await loadPlanetTextures(data.id);
    if (entry.mesh === mesh && textures.map) applyTexturesToPlanet(entry, textures);

    if (data.id === 'saturn') {
      await upgradeSaturnRings(entry);
    }

    if (data.cloudsTexture && !mesh.getObjectByName('clouds')) {
      const cloudTex = await loadTexture(textureUrl(data.cloudsTexture), null);
      if (cloudTex) {
        const cloudGeo = new THREE.SphereGeometry(radius * 1.006, 48, 48);
        const cloudMat = new THREE.MeshPhongMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
          color: 0xffffff,
        });
        const clouds = new THREE.Mesh(cloudGeo, cloudMat);
        clouds.name = 'clouds';
        mesh.add(clouds);
      }
    }
  } catch (err) {
    console.warn(`纹理升级失败 ${data.id}:`, err);
  } finally {
    entry._textureUpgrading = false;
  }
}

function queueTextureUpgrade(entry) {
  if (entry._textureQueued) return;
  entry._textureQueued = true;
  textureUpgradeQueue.push(entry);
  scheduleTextureUpgradeDrain();
}

function scheduleTextureUpgradeDrain() {
  if (textureUpgradeDelayTimer) return;
  textureUpgradeDelayTimer = setTimeout(() => {
    textureUpgradeDelayTimer = null;
    drainTextureUpgradeQueue();
  }, 600);
}

function drainTextureUpgradeQueue() {
  if (textureUpgradePaused) return;
  while (
    textureUpgradeActive < TEXTURE_UPGRADE_CONCURRENCY &&
    textureUpgradeQueue.length
  ) {
    const entry = textureUpgradeQueue.shift();
    textureUpgradeActive++;
    upgradePlanetTextures(entry).finally(() => {
      textureUpgradeActive--;
      if (!textureUpgradePaused) drainTextureUpgradeQueue();
    });
  }
}

/** 首屏程序纹理：逐帧生成，返回 Promise 供启动门控等待 */
function fillProceduralTexturesAsync() {
  const ids = PLANETS.filter((p) => !p.isStar && !p.isMoon).map((p) => p.id);
  let idx = 0;
  return new Promise((resolve) => {
    const step = () => {
      if (idx >= ids.length) {
        resolve();
        return;
      }
      const id = ids[idx++];
      const entry = state.planets.get(id);
      if (entry && !entry._appliedTextures?.map && !entry.mesh?.material?.map) {
        try {
          const map = createProceduralTexture(id);
          if (map) applyTexturesToPlanet(entry, { map, bump: null, roughness: 0.82 });
        } catch (err) {
          console.warn(`程序纹理 ${id} 生成失败:`, err);
        }
      }
      setLoadScreen(
        96 + Math.round((idx / ids.length) * 2),
        `生成行星表面… (${idx}/${ids.length})`
      );
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function waitForPlanetVisualReady(entry, maxMs = 12000) {
  return new Promise((resolve) => {
    if (!entry) {
      resolve();
      return;
    }
    ensurePlanetTextures(entry);
    const start = performance.now();
    const tick = () => {
      const mat = entry.mesh?.material;
      const ready =
        entry.data.isStar || !!mat?.map || !!mat?.uniforms?.uMap || !!mat?.uniforms?.uUseMap?.value;
      if (ready || performance.now() - start > maxMs) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

async function runBootPipeline() {
  try {
    setLoadScreen(94, '恢复上次视角…');
    await restoreSavedView();
    setLoadScreen(96, '生成行星表面…');
    await fillProceduralTexturesAsync();
    if (state.focus && !String(state.focus).includes(':')) {
      const entry = state.planets.get(state.focus);
      setLoadScreen(98, '加载聚焦天体…');
      await waitForPlanetVisualReady(entry);
      if (entry) {
        reapplyCachedTextures(entry);
        setPlanetVisualMode(state.focus);
        applyPlanetFocusLighting(state.focus, entry.data);
      }
    } else {
      setPlanetVisualMode(null);
      applySolarRoamLighting(true);
    }
    applyAstroPositions(new Date());
    markPickMeshesDirty();
    setLoadScreen(99, '正在渲染场景…');
    bootReady = true;
  } catch (err) {
    console.error('启动流程失败:', err);
    bootReady = true;
  }
}

function setTextureUpgradePaused(paused) {
  textureUpgradePaused = paused;
  if (!paused) drainTextureUpgradeQueue();
}

function loadTexture(url, fallbackId) {
  if (!url) {
    return Promise.resolve(
      fallbackId && fallbackId !== 'earth' ? createProceduralTexture(fallbackId) : null
    );
  }
  return loadTextureOnce(url).then((tex) => {
    if (tex) return enhanceTexture(tex);
    return fallbackId && fallbackId !== 'earth' ? createProceduralTexture(fallbackId) : null;
  });
}

function applyNormalMap(mat, textures) {
  if (!textures.bump) return;
  mat.normalMap = textures.bump;
  const ns = textures.normalScale ?? 0.35;
  // 程序生成的法线需翻转 Y，与 Three.js 切线空间一致
  const ny = textures.generatedNormal ? -ns : ns;
  mat.normalScale = new THREE.Vector2(ns, ny);
}

function makeEarthMaterial(textures) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.map,
    emissive: 0x182438,
    emissiveIntensity: 0.06,
    roughness: 0.78,
    metalness: 0.03,
  });
  applyNormalMap(mat, textures);
  return mat;
}

function applySunSurfaceTexture(mesh, map) {
  if (!mesh?.material || !map) return;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  enhanceTexture(map);
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mat = mesh.material;
  if (mat?.uniforms?.uMap) {
    mat.uniforms.uMap.value = map;
    mat.uniforms.uUseMap.value = 1;
    return;
  }
  const old = mesh.material;
  mesh.material = createSunSurfaceMaterial(map);
  if (old?.dispose) old.dispose();
}

function getSaturnRingGroup(entry) {
  return entry?.mesh?.getObjectByName('saturnRings') ?? null;
}

async function upgradeSaturnRings(entry) {
  const cfg = getPlanetTextureConfig('saturn_ring');
  if (!cfg) return;
  const map = await loadTextureChain(cfg.map, { timeoutMs: 5000 });
  if (!map) return;
  const ringGroup = getSaturnRingGroup(entry);
  if (ringGroup) applySaturnRingTexture(ringGroup, map);
}

async function upgradeSunTexture(entry) {
  const cfg = getPlanetTextureConfig('sun');
  if (!cfg) return;
  const map = await loadTextureChain(cfg.map, { timeoutMs: 6000 });
  if (map) applySunSurfaceTexture(entry.mesh, map);
}

function makePlanetMaterial(data, textures) {
  if (data.isStar) return createSunSurfaceMaterial(textures?.map ?? null);
  if (data.id === 'earth') return makeEarthMaterial(textures);

  const gasGiants = new Set(['jupiter', 'saturn', 'uranus', 'neptune']);
  const mat = new THREE.MeshStandardMaterial({
    color: textures.color ? new THREE.Color(textures.color) : 0xffffff,
    roughness: textures.roughness ?? 0.82,
    metalness: data.id === 'mercury' ? 0.06 : 0.02,
    emissive: new THREE.Color(
      data.id === 'venus' ? 0x1a1008 : gasGiants.has(data.id) ? 0x101828 : 0x182438
    ),
    emissiveIntensity: data.id === 'venus' ? 0.04 : gasGiants.has(data.id) ? 0.025 : 0.05,
  });
  if (textures.map) mat.map = textures.map;
  applyNormalMap(mat, textures);
  return mat;
}

function textureUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : TEXTURE_BASE + path;
}

function buildPlanet(data) {
  const radius = visualRadius(data);
  const dist = orbitDistance(data);

  const group = new THREE.Group();
  group.name = data.id;
  group.userData.planetData = data;

  const orbitPivot = new THREE.Group();
  let ring = null;

  if (data.orbitParent) {
    const parent = state.planets.get(data.orbitParent);
    if (parent) {
      // 挂在 bodyGroup 上，避免随地球自转
      parent.bodyGroup.add(orbitPivot);
      if (data.isMoon) {
        ring = createOrbitRing(dist);
        ring.name = 'moonOrbitRing';
        ring.userData.planetId = 'moon';
        parent.bodyGroup.add(ring);
      }
    }
  } else {
    solarGroup.add(orbitPivot);
    if (!data.isMoon && !data.isStar) {
      const el = ORBITAL_ELEMENTS[data.id];
      ring = el
        ? createEllipseOrbitRing(el.a, el.e, DISTANCE_PER_AU, undefined, el.varpi)
        : createOrbitRing(dist);
      ring.name = 'orbitRing';
      ring.userData.planetId = data.id;
      // 日心轨道以太阳为焦点，与行星绝对坐标同一空间
      solarGroup.add(ring);
    }
  }

  const textures = data.isStar
    ? { map: createProceduralSunTexture(), bump: null }
    : getInstantTextures(data.id);

  const hiDetail = new Set(['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon']);
  const segs = data.isStar ? 128 : hiDetail.has(data.id) ? 64 : data.isMoon ? 56 : 48;
  const geo = new THREE.SphereGeometry(radius, segs, segs);
  const mat = makePlanetMaterial(data, textures);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'body';
  mesh.userData.planetId = data.id;

  const obliquity = new THREE.Group();
  obliquity.name = 'obliquity';
  if (data.tilt) {
    // 倾角与自转分轨：大倾角（天王星 ~98°）与 rotation.y 同轴会产生万向节锁，云带会像「横过来」
    obliquity.rotation.x = (data.tilt * Math.PI) / 180;
  }
  const spinPivot = new THREE.Group();
  spinPivot.name = 'spinPivot';
  spinPivot.add(mesh);
  obliquity.add(spinPivot);

  if (data.isStar) {
    const glow = createSunGlow(radius);
    mesh.add(glow);
    mesh.userData.glow = glow;
    if (sunLight.parent) sunLight.parent.remove(sunLight);
    mesh.add(sunLight);
    sunLight.position.set(0, 0, 0);
    applySolarBloom('roam');
    setSunGlowLevel(mesh.userData.glow, 'roam');
  }

  if (data.hasRings) {
    const rings = createSaturnRings(radius, createProceduralSaturnRingTexture());
    rings.rotation.x = Math.PI / 2;
    mesh.add(rings);
  }

  const bodyGroup = new THREE.Group();
  bodyGroup.add(obliquity);

  if (!data.orbitParent && !data.isStar) {
    bodyGroup.position.x = dist;
  } else if (data.orbitParent) {
    bodyGroup.position.set(dist, 0, 0);
  }

  orbitPivot.add(bodyGroup);

  if (data.hasLandmarks || getLandmarks(data.id).length) {
    createLandmarkLabels(mesh, data.id, radius);
  }

  const labelDiv = document.createElement('div');
  labelDiv.className = 'planet-label';
  labelDiv.textContent = data.name;
  labelDiv.style.display = 'none';
  const nameLabel = new CSS2DObject(labelDiv);
  nameLabel.position.set(0, radius * 1.6, 0);
  mesh.add(nameLabel);

  const entry = {
    data,
    group,
    orbitPivot,
    bodyGroup,
    obliquity,
    spinPivot,
    mesh,
    radius,
    dist,
    ring,
    landmarks: mesh.getObjectByName('landmarks'),
  };

  state.planets.set(data.id, entry);
  if (data.isStar) {
    void upgradeSunTexture(entry);
  } else {
    queueTextureUpgrade(entry);
  }
  return entry;
}

function initGalaxySystems() {
  if (exoSystems.size) return;
  const galactic = buildGalacticStarSystems(scene, DISTANCE_PER_AU);
  exoSystems = galactic.systems;
  galaxyOverview = createGalaxyOverviewMarkers();
  scene.add(galaxyOverview);
  rebuildRegionOverview(galaxyOverview, 'milkyway');
  markPickMeshesDirty();
}

function scheduleGalaxyInit(onReady) {
  if (exoSystems.size) {
    onReady?.();
    return;
  }
  showSceneBusy('构建银河系恒星系…');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        initGalaxySystems();
      } catch (err) {
        console.warn('银河系数据加载失败:', err);
      } finally {
        hideSceneBusy();
        onReady?.();
      }
    });
  });
}

function initSolarSystem() {
  setLoadScreen(8, '初始化太阳系…');
  const mainPlanets = PLANETS.filter((p) => !p.isMoon);
  const buildTotal = mainPlanets.length + 1;
  let built = 0;
  for (const p of mainPlanets) {
    try {
      buildPlanet(p);
      built++;
      setLoadScreen(12 + Math.round((built / buildTotal) * 68), `构建 ${p.name}…`);
    } catch (err) {
      console.error(`构建 ${p.name} 失败:`, err);
      window.__buildError = `${p.id}: ${err.message}`;
      throw err;
    }
  }
  const moon = PLANETS.find((p) => p.isMoon);
  if (moon) {
    try {
      buildPlanet(moon);
      built++;
      setLoadScreen(12 + Math.round((built / buildTotal) * 68), '构建月球…');
    } catch (err) {
      console.error('构建月球失败:', err);
      window.__buildError = `moon: ${err.message}`;
      throw err;
    }
  }

  setLoadScreen(86, '布置星空环境…');
  const kuiperBelt = createKuiperBelt(DISTANCE_PER_AU);
  solarGroup.add(kuiperBelt);

  setLoadScreen(94, '同步轨道数据…');
  setSolarOrbitRingsVisible(true, 'roam');
  updateLeftNav();
  applyAstroPositions(new Date());
  markPickMeshesDirty();
  setLoadScreen(93, '准备启动…');
  void runBootPipeline();

  const deferGalaxy = () => {
    try {
      initGalaxySystems();
    } catch (err) {
      console.warn('银河系数据延后加载失败:', err);
    }
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(deferGalaxy, { timeout: 1500 });
  } else {
    setTimeout(deferGalaxy, 200);
  }
}

function syncFocusedOrbitRing(entry, pos) {
  if (!entry?.ring || !pos) return;
  const el = ORBITAL_ELEMENTS[entry.data.id];
  if (!el) return;
  alignOrbitRingToPlanet(
    entry.ring,
    el.a,
    el.e,
    el.varpi,
    DISTANCE_PER_AU,
    pos.x,
    pos.z
  );
}

function applyAstroPositions(date) {
  state.planets.forEach((entry) => {
    const d = entry.data;
    if (d.isStar) return;

    if (d.orbitParent) {
      const moonAngle = getMoonOrbitAngle(date);
      entry.orbitPivot.rotation.y = moonAngle;
      entry.spinPivot.rotation.y = moonAngle;
      if (state.focus === d.id && entry.ring) {
        alignOrbitRingToAngle(entry.ring, entry.dist, moonAngle);
      }
      return;
    }

    if (d.periodDays && !d.orbitParent) {
      const pos = getHeliocentricPosition(d.id, date, DISTANCE_PER_AU);
      entry.bodyGroup.position.set(pos.x, pos.y, pos.z);
      entry.orbitPivot.rotation.y = 0;

      if (state.focus === d.id) {
        syncFocusedOrbitRing(entry, pos);
      }

      if (d.id === 'earth') {
        const spin = getEarthMeshRotation(date, pos.longitude);
        entry.spinPivot.rotation.y = spin;
      } else if (d.rotationHours) {
        const sign = d.rotationHours < 0 ? -1 : 1;
        entry.spinPivot.rotation.y = sign * getAxialSpinAngle(Math.abs(d.rotationHours), date);
      }
    }
  });
}

function addSolarNavItems(list) {
  const addItem = (p) => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    const dot = document.createElement('span');
    dot.className = 'planet-dot';
    dot.style.background = p.color;
    dot.style.color = p.color;
    li.appendChild(dot);
    li.appendChild(document.createTextNode(p.name));
    li.addEventListener('click', () => focusPlanet(p.id));
    list.appendChild(li);
  };
  const addSection = (title) => {
    const li = document.createElement('li');
    li.className = 'nav-section';
    li.textContent = title;
    list.appendChild(li);
  };
  PLANETS.filter((p) => !p.isMoon && !p.isKBO).forEach(addItem);
  const moon = PLANETS.find((p) => p.isMoon);
  if (moon) addItem(moon);
  const kbos = PLANETS.filter((p) => p.isKBO);
  if (kbos.length) {
    addSection('── 柯伊伯带 ──');
    kbos.forEach(addItem);
  }
}

function isExploringInUniverse() {
  return (
    state.viewMode === 'universe' &&
    !!state.activeRegion &&
    state.regionEnteredFrom === 'universe'
  );
}

function clearUniverseExploration() {
  state.activeRegion = null;
  state.activeCosmicId = null;
  state.regionEnteredFrom = null;
  state.regionParent = null;
  state.activeStarSystem = null;
  state.roamingSystemId = null;
  state.focus = null;
  hideAllExoSystems(exoSystems);
  solarGroup.visible = false;
  if (galaxyOverview) galaxyOverview.visible = false;
  document.body.classList.remove('region-mode');
  document.body.classList.add('universe-mode');
  updateGalaxyBackdrop();
}

function shouldStayInUniverseView(from) {
  return state.viewMode === 'universe' || from === 'universe';
}

function updateLeftNav() {
  const title = document.getElementById('nav-title');
  const list = document.getElementById('planet-list');
  const btnBack = document.getElementById('btn-back');
  list.innerHTML = '';

  if (state.viewMode === 'solar') {
    title.textContent = '太阳系导航';
    btnBack.classList.add('hidden');
    addSolarNavItems(list);
    return;
  }

  if (state.viewMode === 'universe' && !isExploringInUniverse()) {
    title.textContent = '宇宙结构导航';
    btnBack.classList.remove('hidden');
    btnBack.textContent = '← 返回太阳系';
    const addCosmicSection = (label, cats) => {
      const section = document.createElement('li');
      section.className = 'nav-section';
      section.textContent = label;
      list.appendChild(section);
      cats.forEach((cat) => {
        getCosmicNavItems(cat).forEach((item) => {
          const li = document.createElement('li');
          li.dataset.cosmicId = item.id;
          li.classList.toggle('active', state.activeCosmicId === item.id);
          const dot = document.createElement('span');
          dot.className = 'planet-dot';
          const col = item.color
            ? `#${(item.color >>> 0).toString(16).padStart(6, '0').slice(-6)}`
            : '#8899ff';
          dot.style.background = col;
          dot.style.color = col;
          li.appendChild(dot);
          li.appendChild(document.createTextNode(item.name));
          li.addEventListener('click', () => visitCosmicStructure(item.id));
          list.appendChild(li);
        });
      });
    };
    addCosmicSection('── 可探索（真实恒星系）──', ['home']);
    addCosmicSection('── 邻近星系（远景）──', ['nearby']);
    addCosmicSection('── 河外星系团（远景）──', ['cluster']);
    return;
  }

  if (state.viewMode !== 'galaxy' && !isExploringInUniverse()) return;

  if (!state.activeStarSystem && state.roamingSystemId !== 'sol') {
    const region = getCosmicRegion(state.activeRegion || 'milkyway');
    title.textContent = `${region?.name || '银河系'} · 天体导航`;
    btnBack.classList.remove('hidden');
    if (state.regionParent) {
      const parent = getCosmicRegion(state.regionParent);
      btnBack.textContent = `← 返回${parent?.name || '上级区域'}`;
    } else if (state.regionEnteredFrom === 'universe') {
      btnBack.textContent = '← 返回全宇宙';
    } else if (state.activeRegion === 'milkyway') {
      btnBack.textContent = '← 返回太阳系视角';
    } else {
      btnBack.textContent = '← 返回全宇宙';
    }
    const systems = getRegionSystems(region) || STAR_SYSTEMS;
    systems.forEach((sys) => {
      const li = document.createElement('li');
      li.dataset.systemId = sys.id;
      const dot = document.createElement('span');
      dot.className = 'planet-dot';
      dot.style.background = sys.starColor;
      dot.style.color = sys.starColor;
      li.appendChild(dot);
      const dist = formatSystemDistance(sys);
      const suffix = sys.regionLink ? '（可进入）' : dist ? `（${dist}）` : '';
      li.classList.toggle(
        'active',
        state.roamingSystemId === sys.id || state.activeStarSystem === sys.id
      );
      li.appendChild(document.createTextNode(`${sys.name}${suffix}`));
      li.addEventListener('click', () => focusStarSystem(sys.id));
      list.appendChild(li);
    });
    return;
  }

  const systemId = state.activeStarSystem || state.roamingSystemId;
  const sys = getStarSystem(systemId);
  const region = getCosmicRegion(state.activeRegion || 'milkyway');
  title.textContent = `${sys.name} · 天体`;
  btnBack.classList.remove('hidden');
  btnBack.textContent = `← 返回${region?.name || '银河系'}总览`;

  if (sys.builtIn) {
    addSolarNavItems(list);
  } else {
    (sys.planets || []).forEach((p) => {
      const li = document.createElement('li');
      li.dataset.planetId = p.id;
      const dot = document.createElement('span');
      dot.className = 'planet-dot';
      dot.style.background = p.color;
      dot.style.color = p.color;
      li.appendChild(dot);
      li.appendChild(document.createTextNode(p.name));
      li.addEventListener('click', () => focusExoPlanet(sys.id, p.id));
      list.appendChild(li);
    });
  }
}

function updateGalaxyBackdrop() {
  setCosmosVisibility(
    cosmos,
    state.viewMode,
    state.activeStarSystem,
    state.roamingSystemId
  );
  syncMilkyWayView(cosmos, {
    viewMode: state.viewMode,
    exploringUniverse: isExploringInUniverse(),
    activeRegion: state.activeRegion,
    activeStarSystem: state.activeStarSystem,
    roamingSystemId: state.roamingSystemId,
  });
}

function getActiveSystemCameraLimits() {
  if (!state.activeStarSystem) return null;
  const sys = getStarSystem(state.activeStarSystem);
  if (!sys) return null;
  if (sys.builtIn) {
    return { maxDistance: 12000, far: VIEW_MODES.galaxy.far, near: 0.1 };
  }
  const cam = getStarSystemCamera(sys, DISTANCE_PER_AU);
  return { maxDistance: cam.maxDistance, far: cam.far, near: cam.near };
}

function positionSolarGroupForMode() {
  if (state.viewMode === 'solar') {
    solarGroup.position.set(0, 0, 0);
    solarGroup.visible = true;
    setSolarOrbitRingsVisible(true, 'roam');
  } else if (
    state.viewMode === 'galaxy' &&
    (state.activeStarSystem === 'sol' || state.roamingSystemId === 'sol')
  ) {
    solarGroup.position.set(...SOL_GALAXY_POS);
    solarGroup.visible = true;
    setSolarOrbitRingsVisible(true, 'roam');
  } else {
    solarGroup.visible = false;
    setSolarOrbitRingsVisible(false);
  }
}

function isSolarOrbitForPlanet(obj, planetId) {
  if (!planetId) return false;
  if (planetId === 'moon') return obj.name === 'moonOrbitRing';
  return obj.name === 'orbitRing' && obj.userData.planetId === planetId;
}

function setSolarOrbitRingsVisible(show, mode = 'roam', focusPlanetId = null) {
  const showFocused =
    show && mode === 'focus' && focusPlanetId && focusPlanetId !== 'sun';
  solarGroup.traverse((obj) => {
    if (obj.name === 'orbitRing' || obj.name === 'moonOrbitRing') {
      if (showFocused) {
        const isTarget = isSolarOrbitForPlanet(obj, focusPlanetId);
        obj.visible = isTarget;
        if (isTarget && obj.material) {
          obj.material.opacity = ORBIT_OPACITY.focus;
          obj.material.needsUpdate = true;
        }
      } else {
        obj.visible = false;
      }
    }
    if (obj.name === 'kuiperBelt') {
      // 聚焦行星时隐藏，避免大颗粒干扰近景
      obj.visible = show && mode !== 'focus';
    }
  });
}

function enterGalaxyOverview(animate = true) {
  state.activeStarSystem = null;
  state.focus = null;
  hideAllExoSystems(exoSystems);
  positionSolarGroupForMode();
  applySolarBloom('galaxy');
  renderer.toneMappingExposure = 1.22;
  updateGalaxyBackdrop();
  if (galaxyOverview) {
    rebuildRegionOverview(galaxyOverview, state.activeRegion || 'milkyway');
    galaxyOverview.visible = true;
  }
  resetLandmarkState(state.planets);
  document.getElementById('hud-right')?.classList.add('hidden');
  document.getElementById('landmark-hint')?.classList.add('hidden');
  document.body.classList.remove('focus-mode');
  updateLeftNav();

  const cfg = VIEW_MODES.galaxy;
  controls.maxDistance = cfg.camMax;
  camera.far = cfg.far;
  camera.near = 0.1;
  camera.updateProjectionMatrix();
  const targetPos = new THREE.Vector3(...cfg.camPos);
  const targetLook = new THREE.Vector3(...cfg.camTarget);
  if (animate) {
    state.animating = true;
    animateTo(targetPos, targetLook, 2).then(() => {
      state.animating = false;
    });
  } else {
    camera.position.copy(targetPos);
    controls.target.copy(targetLook);
    controls.update();
  }
}

function enterCosmicRegion(regionId, options = {}) {
  const region = getCosmicRegion(regionId);
  if (!region || state.animating) return;

  const { from = state.viewMode === 'universe' ? 'universe' : 'topnav', parent = null } = options;
  const stayInUniverse = shouldStayInUniverseView(from);
  focusToken++;
  state.viewMode = stayInUniverse ? 'universe' : 'galaxy';
  state.activeRegion = regionId;
  state.activeCosmicId = regionId;
  state.regionEnteredFrom = stayInUniverse ? 'universe' : from;
  state.regionParent = parent;
  state.activeStarSystem = null;
  state.roamingSystemId = null;
  state.focus = null;
  resetLandmarkState(state.planets);
  document.body.classList.toggle('universe-mode', stayInUniverse);
  document.body.classList.toggle('region-mode', regionId !== 'milkyway');

  hideAllExoSystems(exoSystems);
  solarGroup.visible = false;
  if (galaxyOverview) {
    rebuildRegionOverview(galaxyOverview, regionId);
    galaxyOverview.visible = true;
  }
  updateGalaxyBackdrop();
  document.getElementById('hud-right')?.classList.add('hidden');
  document.getElementById('landmark-hint')?.classList.add('hidden');
  document.body.classList.remove('focus-mode');
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === (stayInUniverse ? 'universe' : 'galaxy'));
  });

  updateLeftNav();
  document.getElementById('btn-back')?.classList.remove('hidden');
  writeViewStateSnapshot();

  let camPos;
  let target;
  let maxDist;
  let far;
  if (region.useBuiltinSystems) {
    const cfg = VIEW_MODES.galaxy;
    camPos = new THREE.Vector3(...cfg.camPos);
    target = new THREE.Vector3(...cfg.camTarget);
    maxDist = cfg.camMax;
    far = cfg.far;
  } else {
    const cam = getRegionOverviewCamera(region);
    camPos = cam.camPos;
    target = cam.target;
    maxDist = cam.maxDistance;
    far = cam.far;
  }
  camera.far = far;
  camera.near = 0.1;
  camera.updateProjectionMatrix();
  controls.maxDistance = maxDist;

  state.animating = true;
  animateTo(camPos, target, 2).then(() => {
    state.animating = false;
    scheduleSaveViewState();
  });
}

function prepareStarSystemScene(systemId, sys) {
  const wp = sys.builtIn ? SOL_GALAXY_POS : getSystemWorldPos(sys, sys.regionId);
  const worldPos = new THREE.Vector3(...wp);
  let camPos;
  let maxDist = 12000;

  if (systemId === 'sol') {
    hideAllExoSystems(exoSystems);
    solarGroup.visible = true;
    solarGroup.position.copy(worldPos);
    setSolarOrbitRingsVisible(true, 'roam');
    camPos = worldPos.clone().add(new THREE.Vector3(80, 220, 380));
    camera.far = VIEW_MODES.galaxy.far;
    camera.near = 0.1;
  } else {
    solarGroup.visible = false;
    setExoSystemsVisible(exoSystems, systemId);
    bloom.strength = 0.4;
    bloom.threshold = 0.9;
    const cam = getStarSystemCamera(sys, DISTANCE_PER_AU);
    camPos = cam.camPos;
    maxDist = cam.maxDistance;
    camera.far = cam.far;
    camera.near = cam.near;
  }
  return { worldPos, camPos, maxDist };
}

function ensureExoSystemReady(systemId) {
  if (!systemId || systemId === 'sol') return;
  initGalaxySystems();
  const sys = getStarSystem(systemId);
  if (!sys) return;
  if (state.activeStarSystem === systemId || state.roamingSystemId === systemId) return;
  if (state.focus) exitFocus();
  state.roamingSystemId = systemId;
  state.activeStarSystem = null;
  state.focus = null;
  if (galaxyOverview) galaxyOverview.visible = false;
  prepareStarSystemScene(systemId, sys);
  updateGalaxyBackdrop();
  updateLeftNav();
  markPickMeshesDirty();
}

function approachStarSystem(systemId) {
  if (state.animating) return;
  if (systemId !== 'sol') initGalaxySystems();
  const sys = getStarSystem(systemId);
  if (!sys) return;

  if (sys.regionLink) {
    enterCosmicRegion(sys.regionLink, {
      from: isExploringInUniverse() ? 'universe' : 'region',
      parent: sys.regionLinkParent || state.activeRegion,
    });
    return;
  }

  if (state.focus) exitFocus();
  state.roamingSystemId = systemId;
  state.activeStarSystem = null;
  state.focus = null;
  resetLandmarkState(state.planets);
  if (galaxyOverview) galaxyOverview.visible = false;
  updateGalaxyBackdrop();
  document.body.classList.remove('focus-mode');
  document.getElementById('hud-right')?.classList.add('hidden');
  markPickMeshesDirty();
  writeViewStateSnapshot();

  const { worldPos, camPos, maxDist } = prepareStarSystemScene(systemId, sys);
  camera.updateProjectionMatrix();
  updateLeftNav();

  state.animating = true;
  animateTo(camPos, worldPos, 1.4).then(() => {
    state.animating = false;
    controls.maxDistance = maxDist;
    scheduleSaveViewState();
  });
}

function enterStarSystem(systemId) {
  if (state.animating) return;
  if (systemId !== 'sol') initGalaxySystems();
  const sys = getStarSystem(systemId);
  if (!sys) return;

  if (sys.regionLink) {
    enterCosmicRegion(sys.regionLink, {
      from: isExploringInUniverse() ? 'universe' : 'region',
      parent: sys.regionLinkParent || state.activeRegion,
    });
    return;
  }

  focusToken++;
  state.roamingSystemId = null;
  state.activeStarSystem = systemId;
  markPickMeshesDirty();
  state.focus = null;
  resetLandmarkState(state.planets);
  if (galaxyOverview) galaxyOverview.visible = false;
  updateGalaxyBackdrop();

  const { worldPos, camPos, maxDist } = prepareStarSystemScene(systemId, sys);
  camera.updateProjectionMatrix();

  updateLeftNav();
  document.getElementById('hud-right')?.classList.add('hidden');
  document.getElementById('btn-back')?.classList.remove('hidden');
  writeViewStateSnapshot();

  state.animating = true;
  animateTo(camPos, worldPos, 1.6).then(() => {
    state.animating = false;
    controls.maxDistance = maxDist;
    scheduleSaveViewState();
  });
}

function returnToRegionOverview(animate = true) {
  state.activeStarSystem = null;
  state.roamingSystemId = null;
  state.focus = null;
  hideAllExoSystems(exoSystems);
  solarGroup.visible = false;
  if (galaxyOverview) {
    rebuildRegionOverview(galaxyOverview, state.activeRegion || 'milkyway');
    galaxyOverview.visible = true;
  }
  updateGalaxyBackdrop();
  resetLandmarkState(state.planets);
  document.getElementById('hud-right')?.classList.add('hidden');
  document.getElementById('landmark-hint')?.classList.add('hidden');
  document.body.classList.remove('focus-mode');
  updateLeftNav();

  const region = getCosmicRegion(state.activeRegion || 'milkyway');
  let camPos;
  let target;
  let maxDist;
  let far;
  if (region?.useBuiltinSystems) {
    const cfg = VIEW_MODES.galaxy;
    camPos = new THREE.Vector3(...cfg.camPos);
    target = new THREE.Vector3(...cfg.camTarget);
    maxDist = cfg.camMax;
    far = cfg.far;
  } else {
    const cam = getRegionOverviewCamera(region);
    camPos = cam.camPos;
    target = cam.target;
    maxDist = cam.maxDistance;
    far = cam.far;
  }
  camera.far = far;
  camera.near = 0.1;
  camera.updateProjectionMatrix();
  controls.maxDistance = maxDist;
  if (animate) {
    state.animating = true;
    animateTo(camPos, target, 1.6).then(() => {
      state.animating = false;
      scheduleSaveViewState();
    });
  } else {
    camera.position.copy(camPos);
    controls.target.copy(target);
    controls.update();
    scheduleSaveViewState();
  }
}

function exitUniverseRegionExplore() {
  clearUniverseExploration();
  document.getElementById('hud-right')?.classList.add('hidden');
  document.body.classList.remove('focus-mode');
  updateLeftNav();
  writeViewStateSnapshot();
  const cfg = VIEW_MODES.universe;
  controls.maxDistance = cfg.camMax;
  camera.far = cfg.far;
  camera.updateProjectionMatrix();
  state.animating = true;
  animateTo(new THREE.Vector3(...cfg.camPos), new THREE.Vector3(...cfg.camTarget), 1.8).then(() => {
    state.animating = false;
    scheduleSaveViewState();
  });
}

function exitStarSystem() {
  if (isExploringInUniverse()) {
    returnToRegionOverview(true);
    return;
  }
  enterGalaxyOverview(true);
}

/** 银河系总览：双击聚焦到恒星系（太阳系直接进入） */
function focusStarSystem(systemId) {
  if (state.animating) return;
  cancelCameraAnimations();
  if (systemId === 'sol') enterStarSystem('sol');
  else approachStarSystem(systemId);
}

function visitCosmicStructure(id) {
  cancelCameraAnimations();
  const item = getCosmicItem(id);
  if (!item) return;
  const region = getRegionByNavItem(id);
  if (region) {
    enterCosmicRegion(region.id, { from: 'universe', parent: null });
    return;
  }
  state.activeCosmicId = id;
  updateLeftNav();
  writeViewStateSnapshot();
  showCosmicPanel(item);
  flyToCosmicPoint(item);
}

function showCosmicPanel(item) {
  const panel = document.getElementById('hud-right');
  panel.classList.remove('hidden');
  document.getElementById('focus-name').textContent = item.name;
  document.getElementById('focus-desc').textContent = item.desc || '大尺度宇宙结构示意标注。';
  document.getElementById('focus-stats').innerHTML = `
    <div class="stat"><span>类型</span><strong>${cosmicCategoryLabel(item.category)}</strong></div>
    <div class="stat"><span>示意坐标</span><strong>${item.pos.map((n) => Math.round(n / 1000) + 'k').join(', ')}</strong></div>
    <div class="stat"><span>结构尺度</span><strong>约 ${Math.round(item.r / 100) / 10} 万光年（示意）</strong></div>
  `;
  document.getElementById('focus-detail').innerHTML = `
    <div class="detail-row"><span>操作提示</span><strong>双击其他天体可切换聚焦 · 仅银河系可探索真实恒星系</strong></div>
  `;
  setLandmarkSectionVisible(false);
}

function cosmicCategoryLabel(cat) {
  const map = {
    home: '可探索恒星系',
    nearby: '邻近星系',
    cluster: '河外星系团',
  };
  return map[cat] || '河外天体';
}

function flyToCosmicPoint(item) {
  const pos = item.pos ?? item;
  const r = item.r ?? 5000;
  const token = ++flyToken;
  const target = new THREE.Vector3(...pos);
  const dist = target.distanceTo(controls.target);
  const viewDist = Math.max(r * 16, 160000, dist * 0.42);
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1) dir.set(0.35, 0.22, 1);
  dir.normalize().multiplyScalar(viewDist);
  const camPos = target.clone().add(dir);
  controls.maxDistance = Math.max(controls.maxDistance, viewDist * 2.8);
  state.animating = true;
  animateTo(camPos, target, 2.2).then(() => {
    if (token !== flyToken) return;
    state.animating = false;
    scheduleSaveViewState();
  });
}

/* ─── Focus / camera ─── */
function getSunEntry() {
  return state.planets.get('sun');
}

/** 太阳系远景漫游：按相机距太阳远近压低曝光，避免行星缩成过曝白点 */
function applySolarRoamLighting(force = false) {
  if (state.viewMode !== 'solar' || state.focus) return;
  const sunEntry = getSunEntry();
  if (!sunEntry) return;
  sunEntry.mesh.getWorldPosition(_sunWorldPos);
  const dist = camera.position.distanceTo(_sunWorldPos);
  if (!force && Math.abs(dist - lastRoamLightDist) < 120) return;
  lastRoamLightDist = dist;
  const far = THREE.MathUtils.clamp((dist - 280) / 4800, 0, 1);
  sunLight.intensity = THREE.MathUtils.lerp(ROAM_LIGHT.sun, 3.6, far);
  ambientLight.intensity = THREE.MathUtils.lerp(ROAM_LIGHT.amb, 0.06, far);
  hemiLight.intensity = THREE.MathUtils.lerp(ROAM_LIGHT.hemi, 0.09, far);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(DEFAULT_TONE_EXPOSURE, 0.92, far);
  bloom.threshold = THREE.MathUtils.lerp(0.98, 0.992, far);
  bloom.strength = THREE.MathUtils.lerp(0.18, 0.08, far);
}

function applySolarBloom(mode) {
  const presets = {
    roam: { strength: 0.24, threshold: 0.97, radius: 0.26 },
    galaxy: { strength: 0.52, threshold: 0.86, radius: 0.42 },
    focusSun: { strength: 0, threshold: 1, radius: 0.2 },
    focusOther: { strength: 0.14, threshold: 0.95, radius: 0.28 },
    focusInner: { strength: 0.12, threshold: 0.95, radius: 0.26 },
    focusOuter: { strength: 0.1, threshold: 0.96, radius: 0.24 },
  };
  const p = presets[mode] ?? presets.roam;
  bloom.strength = p.strength;
  bloom.threshold = p.threshold;
  bloom.radius = p.radius;
}

/** 按日距分级调光：主光压高光，fill/amb/hemi 单独抬背阳面 */
const FOCUS_LIGHTING = {
  sun: { sun: 2.2, fill: 0, amb: 0.05, hemi: 0.07, exposure: 0.92, bloom: 'focusSun' },
  mercury: { sun: 7.8, fill: 0.19, amb: 0.13, hemi: 0.19, exposure: 1.17, bloom: 'focusInner' },
  venus: { sun: 6.5, fill: 0.16, amb: 0.12, hemi: 0.18, exposure: 1.12, bloom: 'focusInner' },
  earth: { sun: 8.8, fill: 0.27, amb: 0.17, hemi: 0.24, exposure: 1.25, bloom: 'focusOther' },
  moon: { sun: 8.2, fill: 0.3, amb: 0.17, hemi: 0.24, exposure: 1.23, bloom: 'focusOther' },
  mars: { sun: 8.0, fill: 0.23, amb: 0.16, hemi: 0.23, exposure: 1.21, bloom: 'focusOther' },
  jupiter: { sun: 6.8, fill: 0.17, amb: 0.12, hemi: 0.17, exposure: 1.13, bloom: 'focusOuter' },
  saturn: { sun: 5.4, fill: 0.15, amb: 0.11, hemi: 0.16, exposure: 1.11, bloom: 'focusOuter' },
  uranus: { sun: 4.6, fill: 0.13, amb: 0.1, hemi: 0.15, exposure: 1.08, bloom: 'focusOuter' },
  neptune: { sun: 4.0, fill: 0.12, amb: 0.1, hemi: 0.14, exposure: 1.07, bloom: 'focusOuter' },
};

function getFocusLighting(id, data) {
  if (FOCUS_LIGHTING[id]) return FOCUS_LIGHTING[id];
  const au = data?.orbitAU ?? 40;
  if (au > 30) {
    return { sun: 2.8, fill: 0.1, amb: 0.09, hemi: 0.13, exposure: 1.05, bloom: 'focusOuter' };
  }
  if (au > 8) {
    return { sun: 4.2, fill: 0.12, amb: 0.1, hemi: 0.14, exposure: 1.07, bloom: 'focusOuter' };
  }
  return FOCUS_LIGHTING.mars;
}

function applyPlanetFocusLighting(id, data) {
  const L = getFocusLighting(id, data);
  focusFillLight.intensity = L.fill;
  hemiLight.intensity = L.hemi;
  ambientLight.intensity = L.amb;
  sunLight.intensity = L.sun;
  renderer.toneMappingExposure = L.exposure;
  applySolarBloom(L.bloom);
  if (id === 'sun') lastRoamLightDist = -1;
}

const GAS_GIANTS = new Set(['jupiter', 'saturn', 'uranus', 'neptune']);
const SATURN_RING_VIEW_BIAS = new THREE.Vector3(0.3, 0.68, 0.38).normalize();

/** 土星环在赤道面内，侧视会收成一条线；聚焦时抬高视角以看见环面 */
const URANUS_VIEW_BIAS = new THREE.Vector3(0.82, 0.18, 0.45).normalize();

function getFocusViewDirection(id, rawDir) {
  const dir = rawDir.clone();
  if (dir.lengthSq() < 1e-4) dir.set(0, 0.35, 1);
  dir.normalize();
  if (id === 'uranus') {
    return dir.clone().lerp(URANUS_VIEW_BIAS, dir.lengthSq() < 1e-4 ? 1 : 0.5).normalize();
  }
  if (id !== 'saturn') return dir;
  if (Math.abs(dir.y) < 0.45) {
    return dir.clone().lerp(SATURN_RING_VIEW_BIAS, 0.65).normalize();
  }
  return dir;
}

/** 按视场角计算能完整容纳球体的最小相机距离 */
function fitSphereCamDist(radius, margin = 1.4) {
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const limiting = Math.min(vFov, hFov);
  return (radius / Math.sin(limiting / 2)) * margin;
}

function getFocusCamDist(id, radius) {
  const table = {
    sun: 7,
    moon: 3.2,
    earth: 5.5,
    mercury: 4.2,
    venus: 4.5,
    mars: 5,
    pluto: 4.5,
    eris: 4.5,
    makemake: 4,
    haumea: 4,
    quaoar: 3.8,
    orcus: 3.8,
    sedna: 4,
    jupiter: 8,
    saturn: 8,
    uranus: 7,
    neptune: 7,
  };
  const ringExtent = id === 'saturn' ? 2.55 : 1;
  return Math.max(radius * (table[id] ?? 5), fitSphereCamDist(radius * ringExtent, 1.55));
}

function getFocusMinDist(id, radius) {
  if (id === 'sun') return radius * 2.5;
  if (GAS_GIANTS.has(id)) return Math.max(radius * 3, fitSphereCamDist(radius) * 0.85);
  return radius * (id === 'moon' ? 2.2 : 2.5);
}

function getFocusMaxDist(radius) {
  return radius * 30;
}

function approachExoPlanet(systemId, planetId) {
  if (state.focus) exitFocus();
  const sysEntry = exoSystems.get(systemId);
  const entry = sysEntry?.planets.get(planetId);
  if (!entry || state.animating) return;

  setExoOrbitRingsVisible(exoSystems, systemId, null);
  document.body.classList.remove('focus-mode');
  document.getElementById('hud-right')?.classList.add('hidden');
  document.querySelectorAll('#planet-list li').forEach((li) => li.classList.remove('active'));

  const worldPos = new THREE.Vector3();
  entry.mesh.getWorldPosition(worldPos);
  const camDist = entry.radius * 14;
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.length() < 0.01) dir.set(0, 0.3, 1).normalize();
  const targetCam = worldPos.clone().add(dir.multiplyScalar(camDist));

  state.animating = true;
  animateTo(targetCam, worldPos, 1.2).then(() => {
    state.animating = false;
    const limits = getActiveSystemCameraLimits();
    if (limits) controls.maxDistance = limits.maxDistance;
  });
}

function approachPlanet(id) {
  if (state.focus) exitFocus();
  const entry = state.planets.get(id);
  if (!entry || state.animating) return;

  if (state.viewMode === 'universe') setViewMode('solar', false);
  else if (state.viewMode === 'galaxy' || isExploringInUniverse()) {
    if (state.activeStarSystem !== 'sol' && state.roamingSystemId !== 'sol') {
      approachStarSystem('sol');
      setTimeout(() => approachPlanet(id), 1700);
      return;
    }
  } else if (state.viewMode !== 'solar') {
    setViewMode('solar', false);
  }

  document.body.classList.remove('focus-mode');
  document.getElementById('hud-right')?.classList.add('hidden');
  document.getElementById('landmark-hint')?.classList.add('hidden');
  applySolarBloom('roam');
  setSunGlowLevel(getSunEntry()?.mesh?.userData?.glow, 'roam');
  setSolarOrbitRingsVisible(true, 'roam');
  if (state.activeStarSystem === 'sol' || state.roamingSystemId === 'sol') {
    document.querySelectorAll('#planet-list li').forEach((li) => {
      li.classList.toggle('active', li.dataset.id === id);
    });
  }

  const worldPos = new THREE.Vector3();
  entry.mesh.getWorldPosition(worldPos);
  const camDist = getFocusCamDist(id, entry.radius) * 3.5;
  const dir = getFocusViewDirection(
    id,
    camera.position.clone().sub(controls.target)
  );
  const targetCam = worldPos.clone().add(dir.multiplyScalar(camDist));

  state.animating = true;
  animateTo(targetCam, worldPos, 1.4).then(() => {
    state.animating = false;
    controls.maxDistance = state.viewMode === 'solar' ? VIEW_MODES.solar.camMax : 12000;
    scheduleSaveViewState();
  });
}

function focusExoPlanet(systemId, planetId) {
  ensureExoSystemReady(systemId);
  const sysEntry = exoSystems.get(systemId);
  const entry = sysEntry?.planets.get(planetId);
  if (!entry) return;
  cancelCameraAnimations();
  const exoMat = entry.mesh?.material;
  if (exoMat?.map && exoMat.color) exoMat.color.setHex(0xffffff);

  focusToken++;
  state.focus = `${systemId}:${planetId}`;
  markPickMeshesDirty();
  state.animating = true;
  document.body.classList.add('focus-mode');
  focusFillLight.intensity = 0.34;
  hemiLight.intensity = 0.24;
  ambientLight.intensity = 0.18;
  bloom.strength = 0.22;
  bloom.threshold = 0.92;
  controls.enablePan = false;
  controls.rotateSpeed = 1.15;
  controls.dampingFactor = 0.04;
  setExoOrbitRingsVisible(exoSystems, systemId, planetId);
  const pos = getEllipticOrbitPosition(entry.data, new Date(), DISTANCE_PER_AU);
  alignOrbitRingToPlanet(
    entry.ring,
    entry.data.a,
    entry.data.e,
    entry.data.varpi ?? 0,
    DISTANCE_PER_AU,
    pos.x,
    pos.z
  );

  document.querySelectorAll('#planet-list li').forEach((li) => {
    li.classList.toggle('active', li.dataset.planetId === planetId);
  });

  const worldPos = new THREE.Vector3();
  entry.mesh.getWorldPosition(worldPos);
  const camDist = Math.max(entry.radius * 5.5, fitSphereCamDist(entry.radius));
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.length() < 0.01) dir.set(0, 0.3, 1).normalize();
  const targetCam = worldPos.clone().add(dir.multiplyScalar(camDist));

  controls.minDistance = getFocusMinDist(planetId, entry.radius);
  controls.maxDistance = getFocusMaxDist(entry.radius);

  const sys = getStarSystem(systemId);
  const token = focusToken;
  animateTo(targetCam, worldPos, 1.2).then(() => {
    if (token !== focusToken) return;
    state.animating = false;
    showExoFocusPanel(sys, entry.data, entry);
    scheduleSaveViewState();
  });
}

function focusPlanet(id) {
  const entry = state.planets.get(id);
  if (!entry) return;
  cancelCameraAnimations();
  ensurePlanetTextures(entry);

  if (state.viewMode === 'universe') setViewMode('solar', false);
  else if (state.viewMode === 'galaxy' || isExploringInUniverse()) {
    if (state.activeStarSystem !== 'sol' && state.roamingSystemId !== 'sol') {
      approachStarSystem('sol');
      setTimeout(() => focusPlanet(id), 1700);
      return;
    }
  } else if (state.viewMode !== 'solar') {
    setViewMode('solar', false);
  }
  clearActiveLandmark();
  state.planets.forEach((e) => {
    if (e.data.id !== id && e.landmarks) {
      updateLandmarkVisibility(e.landmarks, false);
      hideLandmarkMarkers(e.landmarks);
    }
  });
  const token = ++focusToken;
  state.focus = id;
  markPickMeshesDirty();
  state.animating = true;
  document.body.classList.add('focus-mode');
  applyPlanetFocusLighting(id, entry.data);
  setSunGlowLevel(getSunEntry()?.mesh?.userData?.glow, id === 'sun' ? 'full' : 'dim');
  setSolarOrbitRingsVisible(true, 'focus', id);
  if (entry.data.isMoon && entry.ring) {
    alignOrbitRingToAngle(entry.ring, entry.dist, getMoonOrbitAngle(new Date()));
  } else if (!entry.data.orbitParent && !entry.data.isStar) {
    const pos = getHeliocentricPosition(id, new Date(), DISTANCE_PER_AU);
    syncFocusedOrbitRing(entry, pos);
  }
  controls.enablePan = false;
  controls.rotateSpeed = 1.15;
  controls.dampingFactor = 0.04;

  document.querySelectorAll('#planet-list li').forEach((li) => {
    li.classList.toggle('active', li.dataset.id === id);
  });

  const worldPos = new THREE.Vector3();
  entry.mesh.getWorldPosition(worldPos);
  const camDist = getFocusCamDist(id, entry.radius);
  const dir = getFocusViewDirection(
    id,
    camera.position.clone().sub(controls.target)
  );
  const targetCam = worldPos.clone().add(dir.multiplyScalar(camDist));

  controls.minDistance = getFocusMinDist(id, entry.radius);
  controls.maxDistance = getFocusMaxDist(entry.radius);

  ensureLandmarkLabels(entry);
  setPlanetVisualMode(id);
  syncFocusedLandmarks(entry, getLandmarkDisplayMode(), camera);

  animateTo(targetCam, worldPos, 1.5)
    .then(() => {
      if (token !== focusToken || state.focus !== id) return;
      ensurePlanetTextures(entry);
      reapplyCachedTextures(entry);
      setPlanetVisualMode(id);
      showFocusPanel(entry);
      syncFocusedLandmarks(entry, getLandmarkDisplayMode(), camera);
      scheduleSaveViewState();
    })
    .finally(() => {
      if (token === focusToken && state.focus === id) state.animating = false;
    });
}

function setPlanetVisualMode(focusId) {
  const focusEntry = focusId ? state.planets.get(focusId) : null;
  const focusAu = focusEntry?.data?.orbitAU ?? 1;

  state.planets.forEach((e) => {
    const isFocus = focusId && e.data.id === focusId;
    const isSunBackdrop = focusId === 'sun' && !isFocus && !e.data.isStar;
    const planetAu = e.data.orbitParent ? focusAu : (e.data.orbitAU ?? 1);
    const isBgOuter =
      (focusId && !isFocus && planetAu > focusAu * 1.6) || isSunBackdrop;
    if (e.landmarks) {
      updateLandmarkVisibility(e.landmarks, isFocus);
      if (isFocus) syncFocusedLandmarks(e, getLandmarkDisplayMode(), camera);
      else hideLandmarkMarkers(e.landmarks);
    }
    const clouds = e.mesh.getObjectByName('clouds');
    if (clouds) clouds.visible = !isFocus;
    const mat = e.mesh.material;
    const hasMap = !!mat?.map;
    if (mat?.emissiveIntensity !== undefined) {
      if (e.data.id === 'earth' && mat.emissiveMap) {
        mat.emissiveMap = null;
        mat.needsUpdate = true;
      }
      if (e.data.isMoon && isFocus) {
        mat.emissiveIntensity = hasMap ? 0.26 : 0.34;
        if (mat.emissive) mat.emissive.setHex(0x3a5070);
      } else if (e.data.isMoon) {
        mat.emissiveIntensity = 0.28;
        if (mat.emissive) mat.emissive.setHex(0x304860);
      } else if (isFocus && GAS_GIANTS.has(e.data.id)) {
        mat.emissiveIntensity = hasMap ? 0.1 : 0.13;
        if (mat.emissive) mat.emissive.setHex(0x1e2838);
      } else if (isSunBackdrop) {
        mat.emissiveIntensity = 0;
        if (mat.emissive) mat.emissive.setHex(0x000000);
      } else if (isBgOuter && GAS_GIANTS.has(e.data.id)) {
        mat.emissiveIntensity = hasMap ? 0.01 : 0.02;
        if (mat.emissive) mat.emissive.setHex(0x0c1018);
      } else if (isBgOuter) {
        mat.emissiveIntensity = hasMap ? 0.015 : 0.03;
        if (mat.emissive) mat.emissive.setHex(0x101820);
      } else if (focusId && !isFocus && GAS_GIANTS.has(e.data.id)) {
        mat.emissiveIntensity = hasMap ? 0.02 : 0.04;
        if (mat.emissive) mat.emissive.setHex(0x101820);
      } else if (isFocus && e.data.id === 'venus') {
        mat.emissiveIntensity = hasMap ? 0.07 : 0.1;
        if (mat.emissive) mat.emissive.setHex(0x1a1410);
      } else if (isFocus && e.data.id === 'mercury') {
        mat.emissiveIntensity = hasMap ? 0.1 : 0.14;
        if (mat.emissive) mat.emissive.setHex(0x283040);
      } else if (isFocus) {
        mat.emissiveIntensity = hasMap ? 0.13 : 0.17;
        if (mat.emissive) mat.emissive.setHex(hasMap ? 0x283a52 : 0x283a52);
      } else {
        mat.emissiveIntensity = hasMap ? 0.035 : 0.06;
        if (mat.emissive) mat.emissive.setHex(0x141c28);
      }
    }
    if (mat?.color && hasMap) {
      mat.color.setHex(0xffffff);
    }
    e.mesh.children.forEach((child) => {
      if (child.element?.classList?.contains('planet-label')) {
        child.element.style.display = 'none';
      }
    });
  });
}

function habitClass(text) {
  if (/不可居住|极低/.test(text)) return 'danger';
  if (/极高|已广泛|已居住|偏高/.test(text)) return 'good';
  return 'warn';
}

function diffClass(text) {
  const n = parseInt(text, 10);
  if (n >= 9) return 'danger';
  if (n >= 6) return 'warn';
  return 'good';
}

let focusTabsBound = false;

function setFocusPanelTab(tabId) {
  const infoPane = document.getElementById('focus-panel-info');
  const landmarkPane = document.getElementById('focus-panel-landmark');
  const tabs = document.querySelectorAll('.focus-tab');
  const showLandmark = tabId === 'landmark';
  tabs.forEach((btn) => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  infoPane?.classList.toggle('active', !showLandmark);
  landmarkPane?.classList.toggle('active', showLandmark);
  if (infoPane) infoPane.hidden = showLandmark;
  if (landmarkPane) landmarkPane.hidden = !showLandmark;
}

function bindFocusPanelTabs() {
  if (focusTabsBound) return;
  focusTabsBound = true;
  document.querySelectorAll('.focus-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('hidden')) return;
      setFocusPanelTab(btn.dataset.tab);
    });
  });
}

function setLandmarkSectionVisible(show) {
  const tabBar = document.getElementById('focus-panel-tabs');
  const landmarkTab = document.querySelector('.focus-tab[data-tab="landmark"]');
  const list = document.getElementById('landmark-list');

  if (tabBar) tabBar.classList.toggle('hidden', !show);
  if (landmarkTab) landmarkTab.classList.toggle('hidden', !show);

  if (!show) {
    if (list) list.innerHTML = '';
    setFocusPanelTab('info');
    return;
  }

  bindFocusPanelTabs();
  setFocusPanelTab('info');
}

function renderFocusDetail(profile) {
  const detail = document.getElementById('focus-detail');
  if (!profile || !detail) {
    if (detail) detail.innerHTML = '';
    return;
  }
  const envBlock = profile.environment
    ? `<div class="focus-env-block"><h4 class="env-heading">星球环境</h4><p class="env-text">${profile.environment}</p></div>`
    : '';
  const rows = [
    ['生命数量', profile.life, ''],
    ['环境可居住性', profile.habitability, habitClass(profile.habitability)],
    ['抵达难度', profile.difficulty, diffClass(profile.difficulty)],
    ['单程抵达', profile.travelTime, ''],
    ['表面类型', profile.surface, ''],
    ['平均温度', profile.temperature, ''],
    ['大气成分', profile.atmosphere, ''],
  ];
  const statsBlock = rows
    .map(
      ([label, value, cls]) =>
        `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value${cls ? ' ' + cls : ''}">${value}</span></div>`
    )
    .join('');
  detail.innerHTML = envBlock + statsBlock;
}

function showExoFocusPanel(sys, planet, entry) {
  if (bootUiLocked) return;
  document.getElementById('hud-right')?.classList.remove('hidden');
  document.getElementById('btn-back')?.classList.remove('hidden');
  document.getElementById('focus-name').textContent = `${planet.name} · ${sys.nameEn}`;
  document.getElementById('focus-desc').textContent = getExoDesc(planet, sys);
  document.getElementById('focus-stats').innerHTML = `
    <div>所属恒星系：<span>${sys.name}（${sys.distanceLy} ly）</span></div>
    <div>轨道半长轴：<span>${planet.a} AU</span></div>
    <div>偏心率：<span>${planet.e}</span></div>
    <div>行星半径：<span>${planet.radiusKm.toLocaleString()} km</span></div>
    <div>公转周期：<span>${planet.period.toFixed(2)} 天</span></div>
  `;
  renderFocusDetail(getExoProfile(sys.id, planet.id, planet, sys));
  setLandmarkSectionVisible(false);
}

function showFocusPanel(entry) {
  if (bootUiLocked) return;
  const d = entry.data;
  document.getElementById('hud-right').classList.remove('hidden');
  document.getElementById('btn-back').classList.remove('hidden');
  document.getElementById('focus-name').textContent = d.name + ' · ' + d.nameEn;
  document.getElementById('focus-desc').textContent = d.desc;
  const au = d.orbitAU ? d.orbitAU + ' AU' : (d.isMoon ? '地球卫星' : '中心');
  document.getElementById('focus-stats').innerHTML = `
    <div>轨道距离：<span>${au}</span></div>
    <div>半径：<span>${d.radiusKm.toLocaleString()} km</span></div>
    <div>公转周期：<span>${d.periodDays ? d.periodDays + ' 天' : '—'}</span></div>
  `;
  renderFocusDetail(d.profile);
  ensureLandmarkLabels(entry);
  setLandmarkSectionVisible(!!entry.landmarks);
  if (!entry.landmarks) return;
  bindLandmarkModeToggle((mode) => {
    syncFocusedLandmarks(entry, mode, camera);
  });
  populateLandmarkList(d.id, (lm) => {
    setFocusPanelTab('landmark');
    toggleLandmarkFromList(camera, controls, entry.mesh, lm, entry.radius);
  });
}

function exitFocus() {
  focusToken++;
  state.focus = null;
  markPickMeshesDirty();
  state.planets.forEach((e) => reapplyCachedTextures(e));
  document.body.classList.remove('focus-mode');
  focusFillLight.intensity = 0;
  applySolarBloom('roam');
  applySolarRoamLighting(true);
  setSunGlowLevel(getSunEntry()?.mesh?.userData?.glow, 'roam');
  controls.enablePan = true;
  controls.rotateSpeed = 1.1;
  controls.dampingFactor = 0.05;
  resetLandmarkState(state.planets);
  setPlanetVisualMode(null);
  document.getElementById('hud-right').classList.add('hidden');
  document.querySelectorAll('#planet-list li').forEach((li) => li.classList.remove('active'));

  if (state.viewMode === 'solar') {
    document.getElementById('btn-back').classList.add('hidden');
    controls.maxDistance = VIEW_MODES.solar.camMax;
    setSolarOrbitRingsVisible(true, 'roam');
  } else if (
    (state.viewMode === 'galaxy' || isExploringInUniverse()) &&
    (state.activeStarSystem || state.roamingSystemId)
  ) {
    document.getElementById('btn-back').classList.remove('hidden');
    if (state.activeStarSystem === 'sol' || state.roamingSystemId === 'sol') {
      setSolarOrbitRingsVisible(true, 'roam');
    } else if (state.activeStarSystem) {
      setExoOrbitRingsVisible(exoSystems, state.activeStarSystem, null);
    }
    bloom.strength = 0.35;
    bloom.threshold = 0.85;
    const limits = getActiveSystemCameraLimits();
    if (limits) {
      controls.maxDistance = limits.maxDistance;
      camera.far = limits.far;
      camera.near = limits.near;
      camera.updateProjectionMatrix();
    }
  } else if (state.viewMode === 'galaxy' || state.viewMode === 'universe') {
    document.getElementById('btn-back').classList.remove('hidden');
    controls.maxDistance = VIEW_MODES[state.viewMode].camMax;
  }
  controls.minDistance = 2;
  state.animating = false;
  scheduleSaveViewState();
}

function setViewMode(modeId, animate = true) {
  const cfg = VIEW_MODES[modeId];
  if (!cfg) return;

  focusToken++;
  if (modeId !== 'solar' && state.focus) exitFocus();
  state.animating = false;

  state.viewMode = modeId;
  state.activeStarSystem = null;
  state.roamingSystemId = null;
  markPickMeshesDirty();
  const needsGalaxyData = modeId === 'galaxy' || modeId === 'universe';
  const applyGalaxyRegionData = () => {
    if (needsGalaxyData && !exoSystems.size) initGalaxySystems();
    if (modeId === 'galaxy') {
      state.activeRegion = 'milkyway';
      state.regionEnteredFrom = 'topnav';
      state.regionParent = null;
      if (galaxyOverview) rebuildRegionOverview(galaxyOverview, 'milkyway');
    }
  };
  if (needsGalaxyData && !exoSystems.size) {
    scheduleGalaxyInit(() => {
      if (modeId === 'galaxy') {
        state.activeRegion = 'milkyway';
        state.regionEnteredFrom = 'topnav';
        state.regionParent = null;
        if (galaxyOverview) rebuildRegionOverview(galaxyOverview, 'milkyway');
        if (galaxyOverview) galaxyOverview.visible = true;
      }
      updateGalaxyBackdrop();
      updateLeftNav();
    });
  } else {
    applyGalaxyRegionData();
  }
  if (modeId === 'universe') {
    clearUniverseExploration();
  }
  if (modeId !== 'universe') {
    state.activeCosmicId = null;
    document.getElementById('hud-right')?.classList.add('hidden');
  }
  document.body.classList.toggle('universe-mode', modeId === 'universe');
  document.body.classList.toggle('region-mode', modeId === 'galaxy' && state.activeRegion !== 'milkyway');
  updateGalaxyBackdrop();
  resetLandmarkState(state.planets);
  document.getElementById('hud-right')?.classList.add('hidden');
  document.getElementById('landmark-hint')?.classList.add('hidden');
  state.focus = null;
  document.body.classList.remove('focus-mode');

  if (modeId === 'solar') {
    hideAllExoSystems(exoSystems);
    if (galaxyOverview) galaxyOverview.visible = false;
    positionSolarGroupForMode();
    setSolarOrbitRingsVisible(true, 'roam');
    applySolarBloom('roam');
    renderer.toneMappingExposure = DEFAULT_TONE_EXPOSURE;
    document.getElementById('btn-back')?.classList.add('hidden');
  } else if (modeId === 'galaxy') {
    hideAllExoSystems(exoSystems);
    solarGroup.visible = false;
    if (galaxyOverview) galaxyOverview.visible = true;
    document.getElementById('btn-back')?.classList.remove('hidden');
    applySolarBloom('galaxy');
    renderer.toneMappingExposure = 1.22;
  } else {
    hideAllExoSystems(exoSystems);
    solarGroup.visible = false;
    if (galaxyOverview) galaxyOverview.visible = false;
    document.getElementById('btn-back')?.classList.remove('hidden');
    applySolarBloom('roam');
    if (modeId === 'universe') renderer.toneMappingExposure = 1.28;
  }

  controls.maxDistance = cfg.camMax;
  camera.far = cfg.far;
  camera.updateProjectionMatrix();
  updateLeftNav();
  writeViewStateSnapshot();

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === modeId);
  });

  const scaleInfo = document.getElementById('scale-info');
  if (scaleInfo) {
    const hints = {
      solar: '距离比例：1 AU = 80 单位 · 椭圆轨道 + J2000 根数实时推算',
      galaxy: '银河系 · 左侧选择恒星系逐一探索 · 行星位置按历元椭圆轨道推算',
      universe: '全宇宙 · 仅银河系可探索真实恒星系 · 河外天体为远景参考',
    };
    scaleInfo.textContent = hints[modeId] || hints.solar;
  }

  const targetPos = new THREE.Vector3(...cfg.camPos);
  const targetLook = new THREE.Vector3(...cfg.camTarget);
  if (animate) {
    state.animating = true;
    animateTo(targetPos, targetLook, 2.2).then(() => {
      state.animating = false;
      scheduleSaveViewState();
    });
  } else {
    camera.position.copy(targetPos);
    controls.target.copy(targetLook);
    controls.update();
    scheduleSaveViewState();
  }
}

function getFocusedMesh() {
  if (!state.focus) return null;
  if (state.focus.includes(':')) {
    const [sid, pid] = state.focus.split(':');
    return exoSystems.get(sid)?.planets.get(pid)?.mesh ?? null;
  }
  return state.planets.get(state.focus)?.mesh ?? null;
}

function updateFocusedOrbitTarget() {
  const mesh = getFocusedMesh();
  if (!mesh) return;
  mesh.getWorldPosition(focusTargetScratch);
  controls.target.copy(focusTargetScratch);
}

function animateTo(targetPos, targetLook, duration) {
  const flyId = ++cameraFlyToken;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const t0 = performance.now();
  controls.enabled = false;
  return new Promise((resolve) => {
    function finish() {
      controls.enabled = true;
      resolve();
    }
    function step() {
      if (flyId !== cameraFlyToken) {
        finish();
        return;
      }
      const t = Math.min((performance.now() - t0) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetLook, ease);
      if (t < 1) requestAnimationFrame(step);
      else finish();
    }
    step();
  });
}

/* ─── Interaction ─── */
canvas.addEventListener('click', onCanvasClick);
canvas.addEventListener('dblclick', onCanvasDblClick);
document.addEventListener('mousemove', onMouseMove);

function isOverInteractiveHud(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return false;
  if (el === canvas || el.closest('#universe')) return false;
  return !!el.closest(
    '#hud-top, #hud-left, #hud-right, #hud-bottom, #view-switcher, #loading'
  );
}

function hideHoverTooltip() {
  document.getElementById('tooltip')?.classList.add('hidden');
  if (canvas) canvas.style.cursor = 'grab';
}

function findPlanetIdFromObject(obj) {
  let node = obj;
  while (node) {
    if (node.userData?.planetId) return node.userData.planetId;
    node = node.parent;
  }
  return null;
}

function isFocusedPlanetId(id) {
  return !!id && !!state.focus && id === state.focus;
}

function pickPlanetIdFromHits(hits) {
  let focusedHit = null;
  for (let i = 0; i < hits.length; i++) {
    const id = findPlanetIdFromObject(hits[i].object);
    if (!id) continue;
    if (isFocusedPlanetId(id)) {
      focusedHit = id;
      continue;
    }
    return id;
  }
  return focusedHit;
}

const pickBodyMeshes = [];
let pickMeshesDirty = true;

function markPickMeshesDirty() {
  pickMeshesDirty = true;
}

function getPickBodyMeshes() {
  if (!pickMeshesDirty) return pickBodyMeshes;
  pickBodyMeshes.length = 0;
  const solarPick =
    state.viewMode === 'solar' ||
    state.activeStarSystem === 'sol' ||
    state.roamingSystemId === 'sol';
  if (solarPick) {
    state.planets.forEach((entry) => {
      if (!entry.mesh) return;
      pickBodyMeshes.push(entry.mesh);
    });
  }
  const exoPickId = state.activeStarSystem || state.roamingSystemId;
  if (exoPickId && exoPickId !== 'sol') {
    exoSystems.get(exoPickId)?.planets.forEach((p) => {
      if (!p.mesh) return;
      const planetKey = p.mesh.userData.planetId || `${exoPickId}:${p.data.id}`;
      pickBodyMeshes.push(p.mesh);
      if (!isFocusedPlanetId(planetKey)) {
        const pick = p.mesh.getObjectByName('pickSphere');
        if (pick) pickBodyMeshes.push(pick);
      }
    });
  }
  pickMeshesDirty = false;
  return pickBodyMeshes;
}

function pickPlanetAt(clientX, clientY, { forHover = false } = {}) {
  state.mouse.x = (clientX / innerWidth) * 2 - 1;
  state.mouse.y = -(clientY / innerHeight) * 2 + 1;
  state.raycaster.setFromCamera(state.mouse, camera);
  const meshes = getPickBodyMeshes();
  if (meshes.length) {
    const hits = state.raycaster.intersectObjects(meshes, true);
    const usable = forHover
      ? hits.filter((h) => h.object.name === 'body')
      : hits;
    const planetId = pickPlanetIdFromHits(usable);
    if (planetId) return planetId;
  }
  if (
    (state.viewMode === 'galaxy' || isExploringInUniverse()) &&
    !state.activeStarSystem &&
    !state.roamingSystemId &&
    galaxyOverview
  ) {
    const hits = state.raycaster.intersectObjects(galaxyOverview.children, true);
    if (hits.length) {
      const hit = hits[0].object;
      let node = hit;
      while (node && !node.userData?.systemId && !node.userData?.regionLink) {
        node = node.parent;
      }
      const target = node || hit;
      if (target.userData.regionLink) {
        return {
          type: 'region',
          id: target.userData.regionLink,
          parent: target.userData.regionLinkParent || state.activeRegion,
        };
      }
      if (target.userData.systemId) {
        return { type: 'system', id: target.userData.systemId };
      }
    }
  }
  if (
    cosmos &&
    !state.activeStarSystem &&
    !state.roamingSystemId &&
    ((state.viewMode === 'universe' && !isExploringInUniverse()) || state.viewMode === 'galaxy')
  ) {
    const cosmicHits = state.raycaster.intersectObjects(collectCosmicPickTargets(cosmos), false);
    if (cosmicHits.length && cosmicHits[0].object.userData.cosmicId) {
      return { type: 'cosmic', id: cosmicHits[0].object.userData.cosmicId };
    }
  }
  return null;
}

function onCanvasClick() {
  // 导航统一为双击聚焦，单击不触发飞越/进入
}

function onCanvasDblClick(e) {
  const picked = pickPlanetAt(e.clientX, e.clientY);
  if (!picked) return;
  if (typeof picked === 'string') {
    cancelCameraAnimations();
    if (picked.includes(':')) {
      const [systemId, planetId] = picked.split(':');
      focusExoPlanet(systemId, planetId);
    } else {
      focusPlanet(picked);
    }
    return;
  }
  if (picked.type === 'cosmic') {
    visitCosmicStructure(picked.id);
    return;
  }
  if (state.animating) return;
  if (picked.type === 'region') {
    enterCosmicRegion(picked.id, {
      from: isExploringInUniverse() ? 'universe' : 'region',
      parent: picked.parent || state.activeRegion,
    });
    return;
  }
  if (picked.type === 'system') {
    focusStarSystem(picked.id);
  }
}

let hoverPickRaf = 0;
let lastHoverX = 0;
let lastHoverY = 0;

function onMouseMove(e) {
  lastHoverX = e.clientX;
  lastHoverY = e.clientY;
  if (hoverPickRaf) return;
  hoverPickRaf = requestAnimationFrame(runHoverPick);
}

function runHoverPick() {
  hoverPickRaf = 0;
  if (viewDragging) {
    hideHoverTooltip();
    return;
  }
  const tip = document.getElementById('tooltip');
  if (isOverInteractiveHud(lastHoverX, lastHoverY)) {
    hideHoverTooltip();
    return;
  }
  const picked = pickPlanetAt(lastHoverX, lastHoverY, { forHover: true });
  if (picked) {
    if (typeof picked === 'string' && isFocusedPlanetId(picked)) {
      hideHoverTooltip();
      return;
    }
    if (typeof picked === 'object' && picked.type === 'cosmic') {
      const item = getCosmicItem(picked.id);
      const region = getRegionByNavItem(picked.id);
      tip.textContent =
        (item?.name || picked.id) +
        (region ? ' — 双击进入探索' : ' — 双击聚焦');
    } else if (typeof picked === 'object' && picked.type === 'region') {
      const region = getCosmicRegion(picked.id);
      tip.textContent = (region?.name || picked.id) + ' — 双击进入该区域';
    } else if (typeof picked === 'object' && picked.type === 'system') {
      const sys = getStarSystem(picked.id);
      tip.textContent =
        sys.name +
        (sys.regionLink ? ' — 双击进入' : ' — 双击聚焦');
    } else if (typeof picked === 'string' && picked.includes(':')) {
      const [sid, pid] = picked.split(':');
      const p = exoSystems.get(sid)?.planets.get(pid)?.data;
      tip.textContent = `${p?.name || picked} — 双击切换聚焦`;
    } else {
      const entry = state.planets.get(picked);
      tip.textContent = `${entry.data.name} — 双击切换聚焦`;
    }
    tip.style.left = lastHoverX + 'px';
    tip.style.top = lastHoverY + 'px';
    tip.classList.remove('hidden');
    canvas.style.cursor = 'pointer';
    return;
  }
  tip.classList.add('hidden');
  canvas.style.cursor = 'grab';
}

function onBackClick() {
  if (state.focus) {
    exitFocus();
    return;
  }
  if ((state.viewMode === 'galaxy' || isExploringInUniverse()) && state.roamingSystemId && !state.activeStarSystem) {
    state.roamingSystemId = null;
    returnToRegionOverview(true);
    return;
  }
  if ((state.viewMode === 'galaxy' || isExploringInUniverse()) && state.activeStarSystem) {
    exitStarSystem();
    return;
  }
  if (isExploringInUniverse() && !state.activeStarSystem) {
    if (state.regionParent) {
      enterCosmicRegion(state.regionParent, { from: 'universe', parent: null });
      return;
    }
    exitUniverseRegionExplore();
    return;
  }
  if (state.viewMode === 'galaxy' && !state.activeStarSystem) {
    if (state.regionParent) {
      enterCosmicRegion(state.regionParent, {
        from: state.regionEnteredFrom,
        parent: null,
      });
      return;
    }
    if (state.activeRegion !== 'milkyway') {
      setViewMode('universe');
      return;
    }
    setViewMode('solar');
    return;
  }
  if (state.viewMode === 'universe' && state.activeCosmicId) {
    state.activeCosmicId = null;
    document.getElementById('hud-right')?.classList.add('hidden');
    const cfg = VIEW_MODES.universe;
    flyToken++;
    state.animating = true;
    animateTo(new THREE.Vector3(...cfg.camPos), new THREE.Vector3(...cfg.camTarget), 1.8).then(() => {
      state.animating = false;
    });
    updateLeftNav();
    return;
  }
  if (state.viewMode === 'universe') {
    setViewMode('solar');
    return;
  }
  exitFocus();
}

document.getElementById('btn-back').addEventListener('click', onBackClick);

document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (
      view === 'universe' &&
      state.viewMode === 'universe' &&
      (isExploringInUniverse() || state.activeStarSystem || state.roamingSystemId)
    ) {
      exitUniverseRegionExplore();
      document.querySelectorAll('[data-view]').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === 'universe');
      });
      return;
    }
    setViewMode(view);
  });
});

/* ─── Animation loop ─── */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.elapsedTime;

  const now = new Date();
  applyAstroPositions(now);
  if (
    exoSystems.size &&
    (state.viewMode !== 'solar' || state.activeStarSystem || state.roamingSystemId)
  ) {
    applyExoSystemPositions(exoSystems, now, DISTANCE_PER_AU);
  }
  if (state.focus?.includes(':')) {
    const [sid, pid] = state.focus.split(':');
    const exoPlanet = exoSystems.get(sid)?.planets.get(pid);
    if (exoPlanet?.ring) {
      const p = exoPlanet.data;
      const exoPos = getEllipticOrbitPosition(p, now, DISTANCE_PER_AU);
      alignOrbitRingToPlanet(
        exoPlanet.ring,
        p.a,
        p.e,
        p.varpi ?? 0,
        DISTANCE_PER_AU,
        exoPos.x,
        exoPos.z
      );
    }
  }

  state.planets.forEach((entry) => {
    if (entry.data.isStar) updateSunEffects(entry.mesh, elapsed);
  });

  const exoActiveId = state.activeStarSystem || state.roamingSystemId;
  if (exoActiveId && exoActiveId !== 'sol') {
    const exoEntry = exoSystems.get(exoActiveId);
    const glow = exoEntry?.group?.getObjectByName('starGlow');
    if (glow) updateExoStarGlow(glow, elapsed);
    const starMat = exoEntry?.star?.material;
    if (starMat?.uniforms?.uTime) starMat.uniforms.uTime.value = elapsed;
  }

  if (galaxyOverview?.visible) {
    galaxyOverview.traverse((child) => {
      if (child.material?.uniforms?.uTime) {
        child.material.uniforms.uTime.value = elapsed;
      }
    });
    galaxyOverview.children.forEach((marker) => {
      const glow = marker.getObjectByName('starGlow');
      if (glow) updateExoStarGlow(glow, elapsed);
    });
  }

  if (cosmos?.milkyWay?.visible) {
    const bulge = cosmos.milkyWay.getObjectByName('galacticBulge');
    const bulgeGlow = bulge?.getObjectByName('starGlow');
    if (bulgeGlow) updateExoStarGlow(bulgeGlow, elapsed);
  }

  const starfield = scene.getObjectByName('starfield');
  if (starfield?.material?.uniforms?.uTime) {
    starfield.material.uniforms.uTime.value = elapsed;
  }

  if (state.focus && !state.animating && !isCameraAnimating()) {
    updateFocusedOrbitTarget();
  }
  if (state.focus) {
    const entry = state.planets.get(state.focus);
    if (entry?.landmarks) {
      const dist = camera.position.distanceTo(controls.target);
      updateLandmarksByDistance(entry.landmarks, dist, entry.radius, entry.mesh, camera);
    }
  }

  if (state.viewMode === 'solar' && !state.focus) applySolarRoamLighting(false);

  controls.update();
  composer.render();
  if (state.focus) labelRenderer.render(scene, camera);
  if (bootReady && !bootDismissed) {
    bootRenderedFrames++;
    if (bootRenderedFrames === 1) setLoadScreen(99, '正在渲染首帧…');
    tryDismissLoading();
  }

  if (!bootUiLocked && elapsed - hudLastUpdate > 0.35) {
    hudLastUpdate = elapsed;
    updateHudStatus();
  }
}

let hudLastUpdate = 0;

function updateHudStatus() {
  const dist = camera.position.distanceTo(controls.target).toFixed(0);
  const timeStr = formatSimTime(new Date());
  let viewName = VIEW_MODES[state.viewMode]?.name || '太阳系';
  if ((state.viewMode === 'galaxy' || isExploringInUniverse()) && state.activeRegion) {
    viewName = getCosmicRegion(state.activeRegion)?.name || viewName;
  }
  const roamingOrActive = state.activeStarSystem || state.roamingSystemId;
  if (roamingOrActive) {
    viewName = getStarSystem(roamingOrActive)?.name || viewName;
  }
  const focusLabel = state.focus
    ? (state.focus.includes(':')
        ? exoSystems.get(state.focus.split(':')[0])?.planets.get(state.focus.split(':')[1])?.data.name
        : state.planets.get(state.focus)?.data.name) || viewName
    : viewName;
  document.getElementById('camera-info').textContent = state.focus
    ? `【聚焦】${focusLabel} · 距离 ${dist} · 本地 ${timeStr}`
    : `【漫游】${viewName} · 距离 ${dist} · 本地 ${timeStr}`;
}

window.addEventListener('pagehide', persistViewStateOnExit);
window.addEventListener('beforeunload', persistViewStateOnExit);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistViewStateOnExit();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(
    Math.max(320, Math.floor(innerWidth * 0.55)),
    Math.max(240, Math.floor(innerHeight * 0.55))
  );
  updateOrbitLineResolution(innerWidth, innerHeight);
});

animate();
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    try {
      initSolarSystem();
    } catch (err) {
      console.error(err);
      document.getElementById('loading')?.classList.remove('hidden');
      document.getElementById('load-progress').textContent =
        '加载异常: ' + (window.__buildError || err.message);
      document.body.classList.remove('booting');
      document.body.classList.add('boot-ready');
      bootUiLocked = false;
      bootDismissed = true;
    }
  });
});
