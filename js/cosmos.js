import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createExoSystemStarGlow, createSoftPointsMaterial } from './effects.js';

const TWO_PI = Math.PI * 2;
/** 全宇宙总览时放大银河盘，使其在远景中呈旋涡形态（非点团） */
const UNIVERSE_MILKY_SCALE = 5.2;

export const VIEW_MODES = {
  solar: {
    id: 'solar',
    name: '太阳系',
    camMax: 55000,
    camPos: [0, 220, 420],
    camTarget: [0, 0, 0],
    far: 120000,
  },
  galaxy: {
    id: 'galaxy',
    name: '银河系',
    camMax: 320000,
    camPos: [0, 110000, 150000],
    camTarget: [22000, 0, 6000],
    far: 900000,
  },
  universe: {
    id: 'universe',
    name: '全宇宙',
    camMax: 25000000,
    camPos: [0, 6500000, 9500000],
    camTarget: [0, 0, 0],
    far: 120000000,
  },
};

function makeLabel(text, className = 'cosmos-label') {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;
  return new CSS2DObject(div);
}

/** 全宇宙导航：仅真实天体；仅银河系可进入探索恒星系/系外行星 */
export const UNIVERSE_NAV_ITEMS = [
  {
    id: 'milkyway',
    name: '银河系',
    pos: [0, 0, 0],
    r: 1200,
    color: 0xffeecc,
    category: 'home',
    desc: '太阳系及 27 个已证认恒星系，含真实轨道根数与系外行星。',
  },
  {
    id: 'm31',
    name: '仙女座星系 M31',
    pos: [-185000, 8000, 42000],
    r: 900,
    color: 0xc8d8ff,
    category: 'nearby',
    desc: '距约 254 万光年，本星系群最大螺旋星系（远景参考）。',
  },
  {
    id: 'm33',
    name: '三角座星系 M33',
    pos: [-172000, 5000, 88000],
    r: 420,
    color: 0xaabbee,
    category: 'nearby',
    desc: '本星系群第三大星系，真实旋涡结构观测目标。',
  },
  {
    id: 'lmc',
    name: '大麦哲伦云',
    pos: [95000, -12000, -68000],
    r: 520,
    color: 0x99aadd,
    category: 'nearby',
    desc: '银河系最大卫星星系，约 16 万光年。',
  },
  {
    id: 'smc',
    name: '小麦哲伦云',
    pos: [72000, -8000, -82000],
    r: 300,
    color: 0x8899cc,
    category: 'nearby',
    desc: '银河系次要卫星星系，约 20 万光年。',
  },
  {
    id: 'virgo',
    name: '室女座星系团 · M87',
    pos: [620000, 40000, -180000],
    r: 4200,
    category: 'cluster',
    desc: '约 5400 万光年，含 M87 等著名成员星系（远景）。',
  },
  {
    id: 'coma',
    name: '后发座星系团',
    pos: [-480000, 60000, 520000],
    r: 3600,
    category: 'cluster',
    desc: '约 3.2 亿光年，Zwicky 经典星系团样本（远景）。',
  },
];

/** 场景内可拾取、侧栏未列在 UNIVERSE_NAV_ITEMS 中的远景天体 */
export const EXTRA_COSMIC_MARKERS = [
  {
    id: 'm51',
    name: '涡状星系 M51',
    pos: [-240000, 15000, -120000],
    r: 380,
    category: 'nearby',
    desc: '约 2,300 万光年，与伴星系 NGC 5195 相互作用的经典旋涡星系（远景参考）。',
  },
  {
    id: 'm104',
    name: '草帽星系 M104',
    pos: [210000, 22000, 180000],
    r: 350,
    category: 'nearby',
    desc: '约 2,900 万光年，侧向尘埃带显著的 Sa 型星系（远景参考）。',
  },
  {
    id: 'm13',
    name: '武仙座球状星团 M13',
    pos: [45000, 28000, -35000],
    r: 160,
    category: 'nearby',
    desc: '约 2.2 万光年，北天最易观测的球状星团之一（远景参考）。',
  },
  {
    id: 'm87',
    name: '椭圆星系 M87',
    pos: [640000, 38000, -160000],
    r: 1300,
    category: 'cluster',
    desc: '室女座星系团核心成员，约 5,400 万光年，著名喷流星系（远景参考）。',
  },
  {
    id: 'm77',
    name: '赛弗特星系 M77',
    pos: [-520000, 30000, 180000],
    r: 900,
    category: 'cluster',
    desc: '约 4,700 万光年，活跃星系核典型样本（远景参考）。',
  },
  {
    id: 'ngc1275',
    name: '活跃星系 NGC 1275',
    pos: [580000, 45000, -220000],
    r: 1100,
    category: 'cluster',
    desc: '英仙座星系团成员，约 2.2 亿光年，星系际气体相互作用（远景参考）。',
  },
  {
    id: 'antennae',
    name: '碰撞星系 Antennae',
    pos: [-380000, -25000, 620000],
    r: 1000,
    category: 'cluster',
    desc: '约 4,500 万光年，双星系碰撞形成潮汐尾的经典样本（远景参考）。',
  },
  {
    id: 'cartwheel',
    name: '车轮星系 Cartwheel',
    pos: [480000, 60000, 720000],
    r: 950,
    category: 'cluster',
    desc: '约 5 亿光年，环星系形态，由小星系穿心碰撞形成（远景参考）。',
  },
];

export function getCosmicNavItems(category) {
  const seen = new Set();
  const list = [];
  for (const item of [...UNIVERSE_NAV_ITEMS, ...EXTRA_COSMIC_MARKERS]) {
    if (item.category !== category || seen.has(item.id)) continue;
    seen.add(item.id);
    list.push(item);
  }
  return list;
}

function addMarker(group, { id, name, pos, r, color = 0x8899ff, prefix = '◈ ' }) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 12, 12),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  m.position.set(...pos);
  m.name = id ? `cosmic_${id}` : `cosmic_${name}`;
  m.userData.cosmicId = id;
  m.userData.cosmicName = name;
  m.userData.cosmicRadius = r;

  const lbl = makeLabel(prefix + name);
  lbl.position.set(0, r * 1.6, 0);
  m.add(lbl);
  group.add(m);
  return m;
}

function sampleSpiralArmPoint(arms, armIdx, t, scatterScale = 1) {
  const radius = 5500 + t * 56000;
  const twist = Math.log(radius / 5500) * 1.62;
  const armWidth = (0.28 + 0.22 * (1 - t)) * scatterScale;
  const angle =
    (armIdx / arms) * TWO_PI + twist + (Math.random() - 0.5) * armWidth;
  const scatter = (Math.random() - 0.5) * (900 + t * 2400) * scatterScale;
  const perp = angle + Math.PI / 2;
  const x = Math.cos(angle) * radius + Math.cos(perp) * scatter;
  const z = Math.sin(angle) * radius + Math.sin(perp) * scatter;
  const y = (Math.random() - 0.5) * (520 + t * 1500) * (Math.random() < 0.07 ? 2.4 : 1);
  return { x, y, z, radius, t };
}

function spiralGalaxyParticles(count = 36000, arms = 4) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const core = new THREE.Color(0xffe8c0);
  const armHot = new THREE.Color(0xb8d4ff);
  const armCool = new THREE.Color(0x6a90c8);
  const nebula = new THREE.Color(0xd8a8e8);
  const edge = new THREE.Color(0x2e4068);

  for (let i = 0; i < count; i++) {
    const armIdx = i % arms;
    const t = Math.pow(Math.random(), 0.58);
    const p = sampleSpiralArmPoint(arms, armIdx, t);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    const c = core.clone().lerp(armHot, t * 0.72).lerp(armCool, t * 0.55).lerp(edge, t * t);
    if (Math.random() < 0.07 && t > 0.2 && t < 0.82) c.lerp(nebula, 0.28 + Math.random() * 0.22);
    if (Math.random() < 0.035) c.lerp(new THREE.Color(0xffffff), 0.45);
    if (t > 0.88) c.multiplyScalar(0.35 + (1 - t) * 3);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = (0.45 + Math.random() * 1.8 + (1 - t) * 1.6) * (1 - Math.max(0, t - 0.82) * 2.2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const stars = new THREE.Points(
    geo,
    createSoftPointsMaterial({ opacity: 0.9, sizeFactor: 4.4 })
  );
  stars.name = 'galacticStars';
  return stars;
}

/** 暗尘带：压低臂间空隙的「纸片感」，增加纵深 */
function spiralGalaxyDust(count = 9000, arms = 4) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const dustDark = new THREE.Color(0x1a2238);
  const dustBlue = new THREE.Color(0x2a3858);

  for (let i = 0; i < count; i++) {
    const armIdx = i % arms;
    const t = Math.pow(Math.random(), 0.72);
    const p = sampleSpiralArmPoint(arms, armIdx, t, 0.55);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y * 0.65;
    positions[i * 3 + 2] = p.z;
    const c = dustDark.clone().lerp(dustBlue, t * 0.45 + Math.random() * 0.25);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = 1.2 + Math.random() * 3.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const dust = new THREE.Points(
    geo,
    createSoftPointsMaterial({ opacity: 0.22, sizeFactor: 5.6 })
  );
  dust.name = 'galacticDust';
  dust.renderOrder = -1;
  return dust;
}

function createGalacticBulge() {
  const bulge = new THREE.Group();
  bulge.name = 'galacticBulge';

  const coreGlow = createExoSystemStarGlow(1400, '#fff0cc');
  coreGlow.scale.set(3.8, 3.8, 3.8);
  bulge.add(coreGlow);

  return bulge;
}

/** 全宇宙远景星场：按百万级距离缩放点大小，柔边粒子避免「实心白点」 */
function createDistantPointsMaterial({ opacity = 0.32, sizeFactor = 3.4 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uSizeFactor: { value: sizeFactor },
      uDistScale: { value: 480000 },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uSizeFactor;
      uniform float uDistScale;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uSizeFactor * (uDistScale / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.12, d);
        float halo = smoothstep(0.5, 0.28, d) * 0.28;
        gl_FragColor = vec4(vColor, (core + halo) * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function distantGalaxyField(count = 18000) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = TWO_PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 3200000 + Math.random() * 6800000;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    const tint = 0.45 + Math.random() * 0.55;
    colors[i * 3] = 0.55 * tint;
    colors[i * 3 + 1] = 0.68 * tint;
    colors[i * 3 + 2] = 1.0 * tint;
    sizes[i] = 1.2 + Math.random() * 3.8;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const field = new THREE.Points(geo, createDistantPointsMaterial());
  field.name = 'galaxyField';
  return field;
}

/** 银河系原点交互热区（随 milkyWay 缩放，与旋涡盘对齐） */
function addMilkyWayHomeTarget(milkyWay) {
  const hover = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 10, 10),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hover.name = 'universeHomeHover';
  hover.userData.cosmicId = 'milkyway';
  hover.userData.cosmicName = '银河系';
  hover.userData.cosmicRadius = 1200;
  milkyWay.add(hover);
  return hover;
}

export function createCosmos() {
  const group = new THREE.Group();
  group.name = 'cosmos';
  group.visible = false;

  const milkyWay = new THREE.Group();
  milkyWay.name = 'milkyWay';
  milkyWay.rotation.x = 1.08;
  milkyWay.add(spiralGalaxyDust());
  milkyWay.add(spiralGalaxyParticles());
  milkyWay.add(createGalacticBulge());
  addMilkyWayHomeTarget(milkyWay);
  group.add(milkyWay);

  const deepSpace = new THREE.Group();
  deepSpace.name = 'deepSpace';

  const LOCAL_GROUP = [
    { id: 'milkyway', name: '银河系', pos: [0, 0, 0], r: 1200, color: 0xffeecc },
    { id: 'm31', name: '仙女座星系 M31', pos: [-185000, 8000, 42000], r: 900, color: 0xc8d8ff },
    { id: 'm33', name: '三角座星系 M33', pos: [-172000, 5000, 88000], r: 420, color: 0xaabbee },
    { id: 'lmc', name: '大麦哲伦云', pos: [95000, -12000, -68000], r: 520, color: 0x99aadd },
    { id: 'smc', name: '小麦哲伦云', pos: [72000, -8000, -82000], r: 300, color: 0x8899cc },
    { id: 'm51', name: '涡状星系 M51', pos: [-240000, 15000, -120000], r: 380, color: 0xbbccff },
    { id: 'm104', name: '草帽星系 M104', pos: [210000, 22000, 180000], r: 350, color: 0xccddee },
    { id: 'm13', name: '武仙座球状星团 M13', pos: [45000, 28000, -35000], r: 160, color: 0xffeedd },
  ];
  LOCAL_GROUP.forEach((g) => addMarker(deepSpace, { ...g, prefix: '🌌 ' }));

  group.add(deepSpace);

  const universe = new THREE.Group();
  universe.name = 'observableUniverse';

  const cmb = new THREE.Mesh(
    new THREE.SphereGeometry(9800000, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x1a1038,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  cmb.name = 'cmbSphere';
  universe.add(cmb);

  universe.add(distantGalaxyField());

  const addUniverseMarkers = (items, prefix) => {
    const seen = new Set();
    items.forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      addMarker(universe, {
        id: item.id,
        name: item.name,
        pos: item.pos,
        r: item.r,
        color: item.color,
        prefix,
      });
    });
  };
  addUniverseMarkers(
    [...UNIVERSE_NAV_ITEMS.filter((item) => item.category === 'nearby'), ...EXTRA_COSMIC_MARKERS.filter((item) => item.category === 'nearby')],
    '🌌 '
  );
  addUniverseMarkers(
    [...UNIVERSE_NAV_ITEMS.filter((item) => item.category === 'cluster'), ...EXTRA_COSMIC_MARKERS.filter((item) => item.category === 'cluster')],
    '◈ '
  );

  group.add(universe);

  return { group, milkyWay, deepSpace, universe };
}

/** 进入/接近某恒星系时隐藏背景星系盘，避免银河核光晕填满屏幕 */
export function setCosmosVisibility(
  cosmos,
  mode,
  activeStarSystem = null,
  roamingSystemId = null
) {
  if (!cosmos) return;
  const inLocalSystem = mode === 'galaxy' && (activeStarSystem || roamingSystemId);

  if (inLocalSystem) {
    cosmos.group.visible = false;
    return;
  }

  cosmos.group.visible = mode !== 'solar';
  // 全宇宙模式不显示 deepSpace 实体标记（原点银河系硬球会特别突兀）
  cosmos.deepSpace.visible = mode === 'galaxy';
  cosmos.universe.visible = mode === 'universe';
  const field = cosmos.universe?.getObjectByName('galaxyField');
  if (field) field.visible = mode === 'universe';
}

/** 银河系盘面：全宇宙总览显示缩放旋涡，银河系视图显示原尺寸 */
export function syncMilkyWayView(
  cosmos,
  { viewMode, exploringUniverse, activeRegion, activeStarSystem, roamingSystemId }
) {
  if (!cosmos?.milkyWay) return;
  const inSystem = !!(activeStarSystem || roamingSystemId);
  const universeOverview = viewMode === 'universe' && !exploringUniverse && !inSystem;
  const galaxyMilky =
    (viewMode === 'galaxy' || exploringUniverse) &&
    (activeRegion || 'milkyway') === 'milkyway' &&
    !inSystem;

  cosmos.milkyWay.visible = universeOverview || galaxyMilky;
  const scale = universeOverview ? UNIVERSE_MILKY_SCALE : 1;
  cosmos.milkyWay.scale.set(scale, scale, scale);
}

export function getCosmicItem(id) {
  return (
    UNIVERSE_NAV_ITEMS.find((item) => item.id === id) ??
    EXTRA_COSMIC_MARKERS.find((item) => item.id === id) ??
    null
  );
}

/** 宇宙标记碰撞体：悬停与双击共用可见标记球（与显示大小一致） */
export function collectCosmicPickTargets(cosmos) {
  const targets = [];
  for (const root of [cosmos?.universe, cosmos?.deepSpace, cosmos?.milkyWay]) {
    if (!root) continue;
    root.traverse((obj) => {
      if (obj.name === 'universeHomeHover') targets.push(obj);
      else if (obj.name?.startsWith('cosmic_')) targets.push(obj);
    });
  }
  return targets;
}
