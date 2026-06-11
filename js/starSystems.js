import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { getEllipticOrbitPosition } from './astroTime.js';
import {
  createEllipseOrbitRing,
  createExoSystemStarGlow,
  createExoPlanetMaterial,
  createExoStarMaterial,
  createOverviewStarMarker,
  ORBIT_OPACITY,
} from './effects.js';
import {
  COSMIC_REGIONS,
  getExoBuildList,
  getRegionOverviewEntries,
  getSystemWorldPos,
} from './cosmicRegions.js';

export const SOL_GALAXY_POS = [22000, 120, 6000];

/** 银河系中的恒星系（行星轨道根数为简化历元值，按距离排序） */
export const STAR_SYSTEMS = [
  {
    id: 'sol',
    name: '太阳系',
    nameEn: 'Solar System',
    galaxyPos: SOL_GALAXY_POS,
    distanceLy: 0,
    starColor: '#ffcc33',
    starRadius: 12,
    desc: '我们的家园，八大行星与柯伊伯带。',
    builtIn: true,
  },
  {
    id: 'proxima',
    name: '比邻星',
    nameEn: 'Proxima Centauri',
    galaxyPos: [19200, 60, 7800],
    distanceLy: 4.24,
    starColor: '#ff5533',
    starRadius: 3.2,
    desc: '距太阳最近的恒星，宜居带候选行星比邻星 b。',
    planets: [
      { id: 'proxima_d', name: '比邻星 d', a: 0.029, e: 0.04, L0: 0, varpi: 0, period: 5.12, radiusKm: 1800, color: '#aa8877' },
      { id: 'proxima_b', name: '比邻星 b（地球2.0候选）', a: 0.0485, e: 0.0, L0: 72, varpi: 0, period: 11.186, radiusKm: 7150, color: '#44aa88' },
      { id: 'proxima_c', name: '比邻星 c', a: 1.489, e: 0.04, L0: 200, varpi: 0, period: 1928, radiusKm: 3200, color: '#8899aa' },
    ],
  },
  {
    id: 'alpha_cen',
    name: '南门二',
    nameEn: 'Alpha Centauri',
    galaxyPos: [20500, 100, 7200],
    distanceLy: 4.37,
    starColor: '#ffeebb',
    starRadius: 5.5,
    desc: '最近的双星系统，南门二 A/B 合为一组展示。',
    planets: [
      { id: 'alpha_cen_b', name: '候选行星 α Cen Bb', a: 0.04, e: 0.0, L0: 45, varpi: 0, period: 3.24, radiusKm: 5200, color: '#ccaa66' },
    ],
  },
  {
    id: 'sirius',
    name: '天狼星',
    nameEn: 'Sirius',
    galaxyPos: [8500, -80, 14200],
    distanceLy: 8.6,
    starColor: '#aaccff',
    starRadius: 6,
    desc: '夜空中最亮的恒星，双星系统（伴星未单独建模）。',
    planets: [],
  },
  {
    id: 'eps_eridani',
    name: '波江座 ε',
    nameEn: 'Epsilon Eridani',
    galaxyPos: [12000, -120, 18500],
    distanceLy: 10.5,
    starColor: '#ffdd88',
    starRadius: 4.5,
    desc: '邻近类太阳恒星，拥有气态巨行星 AEgir。',
    planets: [
      { id: 'ae_gir', name: 'AEgir (ε Eri b)', a: 3.39, e: 0.25, L0: 80, varpi: 0, period: 2502, radiusKm: 42000, color: '#ccaa77' },
    ],
  },
  {
    id: 'ross128',
    name: '罗斯 128',
    nameEn: 'Ross 128',
    galaxyPos: [28000, 50, 8800],
    distanceLy: 11.0,
    starColor: '#ff6644',
    starRadius: 2.8,
    desc: '安静红矮星，罗斯 128 b 为近地宜居带岩石行星。',
    planets: [
      { id: 'ross128b', name: '罗斯 128 b', a: 0.0496, e: 0.0, L0: 30, varpi: 0, period: 9.87, radiusKm: 8700, color: '#55aa88' },
    ],
  },
  {
    id: 'tau_ceti',
    name: '天仓五',
    nameEn: 'Tau Ceti',
    galaxyPos: [31000, 200, 11000],
    distanceLy: 11.9,
    starColor: '#ffeecc',
    starRadius: 4.8,
    desc: '类似太阳的恒星，拥有多颗候选行星。',
    planets: [
      { id: 'tau_g', name: '天仓五 g', a: 0.133, e: 0.06, L0: 0, varpi: 0, period: 20, radiusKm: 4500, color: '#887766' },
      { id: 'tau_e', name: '天仓五 e', a: 0.538, e: 0.18, L0: 90, varpi: 0, period: 168, radiusKm: 8200, color: '#cc9955' },
      { id: 'tau_f', name: '天仓五 f', a: 1.334, e: 0.03, L0: 210, varpi: 0, period: 636, radiusKm: 12000, color: '#aa7744' },
    ],
  },
  {
    id: 'wolf1061',
    name: '沃夫 1061',
    nameEn: 'Wolf 1061',
    galaxyPos: [25500, 80, 11500],
    distanceLy: 13.8,
    starColor: '#ff5533',
    starRadius: 2.9,
    desc: '红矮星系统，沃夫 1061 c 位于宜居带内侧。',
    planets: [
      { id: 'wolf_b', name: '沃夫 1061 b', a: 0.0375, e: 0.0, L0: 0, varpi: 0, period: 4.89, radiusKm: 5200, color: '#aa7755' },
      { id: 'wolf_c', name: '沃夫 1061 c', a: 0.089, e: 0.0, L0: 120, varpi: 0, period: 17.87, radiusKm: 6800, color: '#44aa88' },
      { id: 'wolf_d', name: '沃夫 1061 d', a: 0.47, e: 0.0, L0: 240, varpi: 0, period: 217.2, radiusKm: 9500, color: '#6699bb' },
    ],
  },
  {
    id: 'gliese876',
    name: '格利泽 876',
    nameEn: 'Gliese 876',
    galaxyPos: [15000, 180, 9200],
    distanceLy: 15.2,
    starColor: '#ff4422',
    starRadius: 3,
    desc: '首个发现多颗行星的红矮星系统，含超级地球与气态行星。',
    planets: [
      { id: 'gj876d', name: '格利泽 876 d', a: 0.021, e: 0.0, L0: 0, varpi: 0, period: 2.34, radiusKm: 4800, color: '#aa8866' },
      { id: 'gj876c', name: '格利泽 876 c', a: 0.13, e: 0.0, L0: 90, varpi: 0, period: 30.01, radiusKm: 14000, color: '#ccaa77' },
      { id: 'gj876b', name: '格利泽 876 b', a: 0.208, e: 0.11, L0: 180, varpi: 0, period: 61.12, radiusKm: 16000, color: '#bb9955' },
      { id: 'gj876e', name: '格利泽 876 e', a: 0.334, e: 0.0, L0: 270, varpi: 0, period: 124.26, radiusKm: 7200, color: '#55aa99' },
    ],
  },
  {
    id: 'gliese832',
    name: '格利泽 832',
    nameEn: 'Gliese 832',
    galaxyPos: [22800, -40, 10200],
    distanceLy: 16.2,
    starColor: '#ff7755',
    starRadius: 2.9,
    desc: '橙矮星系统，832 b 为超级地球，832 c 为冷木星。',
    planets: [
      { id: 'gj832b', name: '格利泽 832 b', a: 0.162, e: 0.08, L0: 0, varpi: 0, period: 35.68, radiusKm: 9800, color: '#55aa88' },
      { id: 'gj832c', name: '格利泽 832 c', a: 3.53, e: 0.18, L0: 140, varpi: 0, period: 3416, radiusKm: 45000, color: '#ccaa77' },
    ],
  },
  {
    id: 'gliese581',
    name: '格利泽 581',
    nameEn: 'Gliese 581',
    galaxyPos: [18500, -90, 4500],
    distanceLy: 20.3,
    starColor: '#ff5533',
    starRadius: 2.8,
    desc: '著名红矮星系统，格利泽 581 g 为潜在宜居行星。',
    planets: [
      { id: 'gj581e', name: '格利泽 581 e', a: 0.02815, e: 0.0, L0: 0, varpi: 0, period: 3.149, radiusKm: 4800, color: '#aa8877' },
      { id: 'gj581b', name: '格利泽 581 b', a: 0.0406, e: 0.0, L0: 51, varpi: 0, period: 5.368, radiusKm: 8500, color: '#bb6644' },
      { id: 'gj581c', name: '格利泽 581 c', a: 0.0721, e: 0.0, L0: 102, varpi: 0, period: 12.914, radiusKm: 12000, color: '#cc8855' },
      { id: 'gj581g', name: '格利泽 581 g（地球2.0候选）', a: 0.13, e: 0.0, L0: 153, varpi: 0, period: 32.1, radiusKm: 7600, color: '#44aa88' },
      { id: 'gj581d', name: '格利泽 581 d', a: 0.218, e: 0.17, L0: 204, varpi: 0, period: 66.87, radiusKm: 14000, color: '#7799aa' },
    ],
  },
  {
    id: 'gliese667c',
    name: '格利泽 667',
    nameEn: 'Gliese 667',
    galaxyPos: [24500, -200, 7500],
    distanceLy: 23.6,
    starColor: '#ff6644',
    starRadius: 2.7,
    desc: '三合星系统（A / B / C），当前展示 C 星及其行星；Cc 为超级地球宜居带候选。',
    planets: [
      { id: 'gj667cb', name: '格利泽 667 Cb', a: 0.05, e: 0.0, L0: 0, varpi: 0, period: 7.2, radiusKm: 5500, color: '#aa7755' },
      { id: 'gj667cc', name: '格利泽 667 Cc', a: 0.125, e: 0.0, L0: 72, varpi: 0, period: 28.1, radiusKm: 8200, color: '#44aa88' },
      { id: 'gj667cf', name: '格利泽 667 Cf', a: 0.16, e: 0.0, L0: 144, varpi: 0, period: 39, radiusKm: 7000, color: '#55bb99' },
      { id: 'gj667cd', name: '格利泽 667 Cd', a: 0.23, e: 0.0, L0: 216, varpi: 0, period: 62, radiusKm: 9000, color: '#6688aa' },
    ],
  },
  {
    id: 'gliese436',
    name: '格利泽 436',
    nameEn: 'Gliese 436',
    galaxyPos: [9000, 140, 11000],
    distanceLy: 33.1,
    starColor: '#ff5533',
    starRadius: 2.6,
    desc: '拥有著名「热海王星」格利泽 436 b 的红矮星系统。',
    planets: [
      { id: 'gj436b', name: '格利泽 436 b', a: 0.029, e: 0.0, L0: 45, varpi: 0, period: 2.644, radiusKm: 18000, color: '#7799cc' },
    ],
  },
  {
    id: 'trappist1',
    name: 'TRAPPIST-1',
    nameEn: 'TRAPPIST-1',
    galaxyPos: [26800, -150, 5200],
    distanceLy: 40.7,
    starColor: '#ff4422',
    starRadius: 2.6,
    desc: '超冷红矮星，拥有 7 颗地球大小行星，多颗位于宜居带。',
    planets: [
      { id: 'trappist_b', name: 'TRAPPIST-1 b', a: 0.01154, e: 0.0, L0: 0, varpi: 0, period: 1.51, radiusKm: 5800, color: '#aa6644' },
      { id: 'trappist_c', name: 'TRAPPIST-1 c', a: 0.0158, e: 0.0, L0: 51, varpi: 0, period: 2.42, radiusKm: 6200, color: '#bb7755' },
      { id: 'trappist_d', name: 'TRAPPIST-1 d', a: 0.0223, e: 0.0, L0: 102, varpi: 0, period: 4.05, radiusKm: 5500, color: '#cc8866' },
      { id: 'trappist_e', name: 'TRAPPIST-1 e', a: 0.0293, e: 0.0, L0: 153, varpi: 0, period: 6.1, radiusKm: 6000, color: '#44aa88' },
      { id: 'trappist_f', name: 'TRAPPIST-1 f', a: 0.0371, e: 0.0, L0: 204, varpi: 0, period: 9.21, radiusKm: 5800, color: '#55bb99' },
      { id: 'trappist_g', name: 'TRAPPIST-1 g', a: 0.0452, e: 0.0, L0: 255, varpi: 0, period: 12.35, radiusKm: 6100, color: '#66ccaa' },
      { id: 'trappist_h', name: 'TRAPPIST-1 h', a: 0.0593, e: 0.0, L0: 306, varpi: 0, period: 20.13, radiusKm: 4800, color: '#77ddbb' },
    ],
  },
  {
    id: 'lhs1140',
    name: 'LHS 1140',
    nameEn: 'LHS 1140',
    galaxyPos: [34000, 280, 3200],
    distanceLy: 41.0,
    starColor: '#ff5533',
    starRadius: 2.5,
    desc: '致密超级地球 LHS 1140 b，可能有浓厚大气层。',
    planets: [
      { id: 'lhs1140b', name: 'LHS 1140 b', a: 0.0875, e: 0.0, L0: 60, varpi: 0, period: 24.74, radiusKm: 9100, color: '#5599bb' },
    ],
  },
  {
    id: 'hd40307',
    name: 'HD 40307',
    nameEn: 'HD 40307',
    galaxyPos: [16000, -250, 14000],
    distanceLy: 42.0,
    starColor: '#ffddaa',
    starRadius: 4.2,
    desc: '橙矮星，拥有多颗超级地球，其中 HD 40307 g 位于宜居带。',
    planets: [
      { id: 'hd40307b', name: 'HD 40307 b', a: 0.047, e: 0.0, L0: 0, varpi: 0, period: 4.31, radiusKm: 6500, color: '#aa8866' },
      { id: 'hd40307c', name: 'HD 40307 c', a: 0.081, e: 0.0, L0: 72, varpi: 0, period: 9.62, radiusKm: 7200, color: '#bb9977' },
      { id: 'hd40307d', name: 'HD 40307 d', a: 0.133, e: 0.0, L0: 144, varpi: 0, period: 20.4, radiusKm: 6800, color: '#ccaa88' },
      { id: 'hd40307g', name: 'HD 40307 g', a: 0.6, e: 0.0, L0: 216, varpi: 0, period: 197.8, radiusKm: 8500, color: '#44aa88' },
    ],
  },
  {
    id: 'gj1214',
    name: '格利泽 1214',
    nameEn: 'GJ 1214',
    galaxyPos: [4200, -60, 16000],
    distanceLy: 48.0,
    starColor: '#ff6644',
    starRadius: 2.4,
    desc: '拥有迷你海王星格利泽 1214 b 的红矮星，Transit 观测经典目标。',
    planets: [
      { id: 'gj1214b', name: '格利泽 1214 b', a: 0.014, e: 0.0, L0: 30, varpi: 0, period: 1.58, radiusKm: 16000, color: '#7799bb' },
    ],
  },
  {
    id: 'gliese163',
    name: '格利泽 163',
    nameEn: 'Gliese 163',
    galaxyPos: [5800, 180, 12500],
    distanceLy: 49.4,
    starColor: '#ff5533',
    starRadius: 2.6,
    desc: '红矮星系统，格利泽 163 c 为宜居带超级地球候选。',
    planets: [
      { id: 'gj163b', name: '格利泽 163 b', a: 0.0601, e: 0.0, L0: 0, varpi: 0, period: 8.632, radiusKm: 9000, color: '#bb8866' },
      { id: 'gj163c', name: '格利泽 163 c', a: 0.1254, e: 0.0, L0: 90, varpi: 0, period: 25.58, radiusKm: 8200, color: '#44aa88' },
      { id: 'gj163d', name: '格利泽 163 d', a: 0.35, e: 0.0, L0: 200, varpi: 0, period: 108.4, radiusKm: 11000, color: '#8899aa' },
    ],
  },
  {
    id: 'kepler1649',
    name: '开普勒-1649',
    nameEn: 'Kepler-1649',
    galaxyPos: [-8000, 250, 32000],
    distanceLy: 301,
    starColor: '#ff5533',
    starRadius: 2.5,
    desc: '红矮星系统，开普勒-1649 b 为近星宜居带候选。',
    planets: [
      { id: 'kepler1649b', name: '开普勒-1649 b', a: 0.0519, e: 0.0, L0: 45, varpi: 0, period: 8.689, radiusKm: 6700, color: '#55aa88' },
    ],
  },
  {
    id: 'kepler438',
    name: '开普勒-438',
    nameEn: 'Kepler-438',
    galaxyPos: [-15000, 320, 26000],
    distanceLy: 473,
    starColor: '#ff6644',
    starRadius: 3.1,
    desc: '红矮星系统，开普勒-438 b 为岩石行星宜居带候选。',
    planets: [
      { id: 'kepler438b', name: '开普勒-438 b', a: 0.166, e: 0.0, L0: 60, varpi: 0, period: 35.2, radiusKm: 7100, color: '#44aa88' },
    ],
  },
  {
    id: 'kepler186',
    name: '开普勒-186',
    nameEn: 'Kepler-186',
    galaxyPos: [-12000, 400, 28000],
    distanceLy: 582,
    starColor: '#ff6644',
    starRadius: 3.2,
    desc: '「地球2.0」著名候选，开普勒-186 f 位于宜居带。',
    planets: [
      { id: 'kepler186b', name: '开普勒-186 b', a: 0.0343, e: 0.0, L0: 0, varpi: 0, period: 3.89, radiusKm: 4200, color: '#aa7755' },
      { id: 'kepler186c', name: '开普勒-186 c', a: 0.0451, e: 0.0, L0: 60, varpi: 0, period: 7.27, radiusKm: 5800, color: '#bb8866' },
      { id: 'kepler186d', name: '开普勒-186 d', a: 0.0781, e: 0.0, L0: 120, varpi: 0, period: 13.34, radiusKm: 6200, color: '#cc9977' },
      { id: 'kepler186e', name: '开普勒-186 e', a: 0.11, e: 0.0, L0: 180, varpi: 0, period: 22.4, radiusKm: 5500, color: '#ddaa88' },
      { id: 'kepler186f', name: '开普勒-186 f（地球2.0）', a: 0.432, e: 0.0, L0: 240, varpi: 0, period: 129.9, radiusKm: 7400, color: '#44aa88' },
    ],
  },
  {
    id: 'kepler22',
    name: '开普勒-22',
    nameEn: 'Kepler-22',
    galaxyPos: [-18000, 350, 22000],
    distanceLy: 638,
    starColor: '#ffdd88',
    starRadius: 4.8,
    desc: '类太阳恒星，开普勒-22 b 为首批宜居带候选之一。',
    planets: [
      { id: 'kepler22b', name: '开普勒-22 b', a: 0.849, e: 0.0, L0: 90, varpi: 0, period: 289.9, radiusKm: 12000, color: '#5599cc' },
    ],
  },
  {
    id: 'kepler296',
    name: '开普勒-296',
    nameEn: 'Kepler-296',
    galaxyPos: [-22000, 280, 35000],
    distanceLy: 737,
    starColor: '#ff6644',
    starRadius: 3.2,
    desc: '双星系统，拥有 5 颗凌星行星，分属双星两侧。',
    planets: [
      { id: 'kepler296d', name: '开普勒-296 d', a: 0.054, e: 0.0, L0: 0, varpi: 0, period: 5.65, radiusKm: 5800, color: '#aa7755' },
      { id: 'kepler296e', name: '开普勒-296 e', a: 0.067, e: 0.0, L0: 60, varpi: 0, period: 7.49, radiusKm: 7900, color: '#bb8866' },
      { id: 'kepler296b', name: '开普勒-296 b', a: 0.101, e: 0.0, L0: 120, varpi: 0, period: 10.92, radiusKm: 5700, color: '#cc9977' },
      { id: 'kepler296f', name: '开普勒-296 f', a: 0.105, e: 0.0, L0: 180, varpi: 0, period: 14.58, radiusKm: 9300, color: '#ddaa88' },
      { id: 'kepler296g', name: '开普勒-296 g', a: 0.133, e: 0.0, L0: 240, varpi: 0, period: 19.85, radiusKm: 5800, color: '#55aa88' },
      { id: 'kepler296c', name: '开普勒-296 c', a: 0.17, e: 0.0, L0: 300, varpi: 0, period: 25.61, radiusKm: 8100, color: '#66bb99' },
    ],
  },
  {
    id: 'kepler62',
    name: '开普勒-62',
    nameEn: 'Kepler-62',
    galaxyPos: [45000, -400, -8000],
    distanceLy: 1200,
    starColor: '#ff6644',
    starRadius: 3.5,
    desc: '开普勒任务明星系统，62 e/f 均位于宜居带。',
    planets: [
      { id: 'kepler62b', name: '开普勒-62 b', a: 0.055, e: 0.0, L0: 0, varpi: 0, period: 5.7, radiusKm: 4800, color: '#aa7755' },
      { id: 'kepler62c', name: '开普勒-62 c', a: 0.093, e: 0.0, L0: 60, varpi: 0, period: 12.4, radiusKm: 5200, color: '#bb8866' },
      { id: 'kepler62d', name: '开普勒-62 d', a: 0.12, e: 0.0, L0: 120, varpi: 0, period: 18.2, radiusKm: 5800, color: '#cc9977' },
      { id: 'kepler62e', name: '开普勒-62 e', a: 0.427, e: 0.0, L0: 180, varpi: 0, period: 122.4, radiusKm: 8200, color: '#44aa88' },
      { id: 'kepler62f', name: '开普勒-62 f', a: 0.718, e: 0.0, L0: 240, varpi: 0, period: 267.3, radiusKm: 7600, color: '#55bb99' },
    ],
  },
  {
    id: 'kepler442',
    name: '开普勒-442',
    nameEn: 'Kepler-442',
    galaxyPos: [38000, 500, 22000],
    distanceLy: 1206,
    starColor: '#ff6644',
    starRadius: 3.4,
    desc: '开普勒-442 b 为高宜居指数超级地球候选。',
    planets: [
      { id: 'kepler442b', name: '开普勒-442 b', a: 0.409, e: 0.0, L0: 75, varpi: 0, period: 112.3, radiusKm: 6800, color: '#44aa88' },
    ],
  },
  {
    id: 'kepler452',
    name: '开普勒-452',
    nameEn: 'Kepler-452',
    galaxyPos: [35000, 300, 15000],
    distanceLy: 1402,
    starColor: '#ffcc66',
    starRadius: 5,
    desc: '「地球表哥」所在系统，主星类似太阳，452 b 轨道与地球相近。',
    planets: [
      { id: 'kepler452b', name: '开普勒-452 b（地球表哥）', a: 1.046, e: 0.0, L0: 90, varpi: 0, period: 384.8, radiusKm: 8500, color: '#5599cc' },
    ],
  },
  {
    id: 'kepler1647',
    name: '开普勒-1647',
    nameEn: 'Kepler-1647',
    galaxyPos: [52000, -600, 38000],
    distanceLy: 3705,
    starColor: '#ffdd88',
    starRadius: 4.5,
    desc: '双星系统，开普勒-1647 b 为首个宜居带环双星行星（气态巨行星）。',
    planets: [
      { id: 'kepler1647b', name: '开普勒-1647 b', a: 2.5, e: 0.05, L0: 60, varpi: 0, period: 1107.59, radiusKm: 38000, color: '#ccaa77' },
    ],
  },
];

export function getStarSystem(id) {
  const builtIn = STAR_SYSTEMS.find((s) => s.id === id);
  if (builtIn) return { ...builtIn, regionId: 'milkyway' };
  for (const region of COSMIC_REGIONS) {
    if (region.useBuiltinSystems) continue;
    const sys = region.systems?.find((s) => s.id === id);
    if (sys) return { ...sys, regionId: region.id };
  }
  return null;
}

function planetVisualRadius(radiusKm, orbitAU, scale) {
  const orbitR = orbitAU * scale;
  const physical = Math.max(radiusKm * 0.00045, 0.25);
  return Math.min(physical, orbitR * 0.2);
}

/** 恒星视觉半径：不得吞没最内层行星轨道 */
export function computeExoStarRadius(sys, scale) {
  const planets = sys.planets || [];
  if (!planets.length) return Math.min(sys.starRadius, 1.2);
  const minOrbit = Math.min(...planets.map((p) => p.a)) * scale;
  return Math.min(sys.starRadius, minOrbit * 0.22, 1.8);
}

/** 取景范围：远轨道与内行星群差距大时，默认框住内层行星 */
export function getSystemFrameRadius(sys, scale) {
  const radii = (sys.planets || []).map((p) => p.a * scale).sort((a, b) => a - b);
  if (!radii.length) return scale * 2;
  let frameMax = radii[radii.length - 1];
  for (let i = radii.length - 1; i > 0; i--) {
    if (radii[i] / radii[i - 1] > 3) {
      frameMax = radii[i - 1] * 1.5;
      break;
    }
  }
  return Math.max(frameMax * 1.6, radii[0] * 10, 18);
}

/** 进入恒星系时的相机参数 */
export function getStarSystemCamera(sys, scale) {
  const frame = getSystemFrameRadius(sys, scale);
  const wp = getSystemWorldPos(sys, sys.regionId);
  const worldPos = new THREE.Vector3(...wp);
  const camPos = worldPos.clone().add(
    new THREE.Vector3(frame * 0.22, frame * 0.72, frame * 1.25)
  );
  return {
    worldPos,
    camPos,
    maxDistance: frame * 8,
    far: Math.max(frame * 60, 6000),
    near: 0.05,
  };
}

export function buildGalacticStarSystems(scene, scale) {
  const root = new THREE.Group();
  root.name = 'galacticSystems';
  const systems = new Map();

  getExoBuildList(STAR_SYSTEMS).forEach(({ sys, worldPos }) => {
    const group = new THREE.Group();
    group.name = sys.id;
    group.position.set(...worldPos);
    group.userData.systemId = sys.id;
    group.userData.regionId = sys.regionId;

    const starR = computeExoStarRadius(sys, scale);
    group.add(createExoSystemStarGlow(starR, sys.starColor));

    const starCol = new THREE.Color(sys.starColor);
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(starR, 48, 48),
      createExoStarMaterial(sys.starColor)
    );
    star.name = 'star';
    star.renderOrder = 1;
    group.add(star);

    const light = new THREE.PointLight(starCol, 8, 0, 0.48);
    light.position.set(0, 0, 0);
    group.add(light);

    const planets = new Map();
    (sys.planets || []).forEach((p) => {
      const orbitPivot = new THREE.Group();
      const r = planetVisualRadius(p.radiusKm, p.a, scale);
      const bodyGroup = new THREE.Group();
      const mat = createExoPlanetMaterial(p, sys.id);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 64), mat);
      mesh.name = 'body';
      mesh.renderOrder = 5;
      mesh.userData.planetId = `${sys.id}:${p.id}`;
      mesh.userData.systemId = sys.id;
      const pickR = Math.max(r * 5.5, 0.65);
      const pickSphere = new THREE.Mesh(
        new THREE.SphereGeometry(pickR, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false, depthWrite: false })
      );
      pickSphere.name = 'pickSphere';
      pickSphere.userData.planetId = `${sys.id}:${p.id}`;
      mesh.add(pickSphere);
      bodyGroup.add(mesh);

      const ring = createEllipseOrbitRing(p.a, p.e, scale, undefined, p.varpi ?? 0);
      ring.name = 'orbitRing';
      ring.userData.planetId = p.id;
      group.add(ring);

      orbitPivot.add(bodyGroup);
      group.add(orbitPivot);

      const labelDiv = document.createElement('div');
      labelDiv.className = 'planet-label';
      labelDiv.textContent = p.name;
      labelDiv.style.display = 'none';
      const nameLabel = new CSS2DObject(labelDiv);
      nameLabel.position.set(0, r * 1.5, 0);
      mesh.add(nameLabel);

      planets.set(p.id, { data: p, orbitPivot, bodyGroup, mesh, radius: r, ring });
    });

    group.visible = false;
    root.add(group);
    systems.set(sys.id, { data: sys, group, star, planets });
  });

  scene.add(root);
  return { root, systems };
}

export function applyExoSystemPositions(systems, date, scale) {
  systems.forEach((entry) => {
    entry.planets.forEach((planet) => {
      const pos = getEllipticOrbitPosition(planet.data, date, scale);
      planet.bodyGroup.position.set(pos.x, pos.y, pos.z);
      planet.orbitPivot.rotation.y = 0;
    });
  });
}

export function setExoSystemsVisible(systems, systemId) {
  systems.forEach((entry, id) => {
    const active = systemId === id;
    entry.group.visible = active;
    if (active) {
      setExoOrbitRingsVisible(systems, systemId, null);
      entry.planets.forEach((p) => {
        p.mesh.children.forEach((c) => {
          if (c.element?.classList?.contains('planet-label')) {
            c.element.style.display = 'none';
          }
        });
      });
    }
  });
}

/** 漫游隐藏轨道；聚焦时仅显示当前行星轨道 */
export function setExoOrbitRingsVisible(systems, systemId, planetId) {
  const entry = systems.get(systemId);
  if (!entry) return;
  entry.planets.forEach((p, id) => {
    if (!p.ring?.material) return;
    const show = planetId != null && planetId === id;
    p.ring.visible = show;
    if (show) p.ring.material.opacity = ORBIT_OPACITY.focus;
  });
}

export function hideAllExoSystems(systems) {
  systems.forEach((entry) => {
    entry.group.visible = false;
  });
}

/** 区域总览光点（银河系 / 星系团 / 河外星系） */
export function createGalaxyOverviewMarkers() {
  const group = new THREE.Group();
  group.name = 'galaxyOverviewMarkers';
  group.visible = false;
  return group;
}

export function rebuildRegionOverview(group, regionId) {
  while (group.children.length) group.remove(group.children[0]);
  const region = COSMIC_REGIONS.find((r) => r.id === regionId);
  if (!region) return;
  const entries = getRegionOverviewEntries(region, STAR_SYSTEMS);
  entries.forEach(({ sys, worldPos }) => {
    const isLink = !!sys.regionLink;
    const isBuiltIn = !!sys.builtIn;
    const size = isBuiltIn ? 280 : isLink ? 240 : 190;
    const m = createOverviewStarMarker(sys.starColor, size);
    m.position.set(...worldPos);
    m.userData.systemId = sys.id;
    if (sys.regionLink) {
      m.userData.regionLink = sys.regionLink;
      if (sys.regionLinkParent) m.userData.regionLinkParent = sys.regionLinkParent;
    }
    group.add(m);
  });
}

export function getRegionOverviewCamera(region) {
  if (!region) return null;
  if (region.useBuiltinSystems) return null;
  const origin = new THREE.Vector3(...region.origin);
  const spread = region.overviewSpread ?? 30000;
  return {
    camPos: origin.clone().add(new THREE.Vector3(spread * 0.45, spread * 0.75, spread * 1.05)),
    target: origin,
    maxDistance: spread * 5,
    far: Math.max(spread * 30, 2000000),
    near: 0.1,
  };
}
