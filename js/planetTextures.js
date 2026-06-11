/**
 * 太阳系行星真实纹理（Solar System Scope / NASA / Wikimedia）
 * 每颗天体仅使用其专属贴图，禁止跨天体占位
 */

const SSS = 'https://www.solarsystemscope.com/textures/download';
const ART = 'https://cdn.jsdelivr.net/npm/artastra@1.0.8/textures';
const THREE_PLANETS =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets';
const LOCAL = 'textures/planets';
const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

function chain(...parts) {
  return parts.filter(Boolean);
}

/** @type {Record<string, { map: string[], normal?: string[], normalScale?: number, generateNormal?: boolean, roughness?: number }>} */
export const PLANET_TEXTURE_SETS = {
  sun: {
    map: chain(
      `${LOCAL}/2k_sun.jpg`,
      `https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_sun.jpg`,
      `${WIKI}/b/b4/Solarsystemscope_texture_2k_sun.jpg`,
      `${SSS}/2k_sun.jpg`
    ),
    generateNormal: false,
  },
  mercury: {
    map: chain(
      `${LOCAL}/2k_mercury.jpg`,
      `https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_mercury.jpg`,
      `${WIKI}/9/92/Solarsystemscope_texture_2k_mercury.jpg`,
      `${SSS}/2k_mercury.jpg`
    ),
    normalScale: 0.32,
    generateNormal: true,
    roughness: 0.82,
  },
  venus: {
    map: chain(
      `${LOCAL}/2k_venus_atmosphere.jpg`,
      `${SSS}/2k_venus_atmosphere.jpg`,
      `${SSS}/2k_venus_surface.jpg`
    ),
    normalScale: 0.2,
    generateNormal: true,
    roughness: 0.55,
  },
  earth: {
    map: chain(
      `${THREE_PLANETS}/earth_atmos_2048.jpg`,
      `${LOCAL}/earth_atmos_2048.jpg`,
      'https://cdn.jsdelivr.net/npm/three-globe@2.34.0/example/img/earth-blue-marble.jpg'
    ),
    normal: chain(
      `${THREE_PLANETS}/earth_normal_2048.jpg`,
      `${LOCAL}/earth_normal_2048.jpg`,
      `${SSS}/8k_earth_normal_map.jpg`
    ),
    normalScale: 0.35,
    generateNormal: false,
    roughness: 0.75,
  },
  moon: {
    map: chain(
      `${THREE_PLANETS}/moon_1024.jpg`,
      `${LOCAL}/2k_moon.jpg`,
      `${SSS}/2k_moon.jpg`,
      `${ART}/moon.jpg`
    ),
    normalScale: 0.42,
    generateNormal: true,
    roughness: 0.92,
  },
  mars: {
    map: chain(
      `${LOCAL}/2k_mars.jpg`,
      `${SSS}/2k_mars.jpg`,
      `${ART}/mars.jpg`,
      `${WIKI}/0/02/Solarsystemscope_texture_2k_mars.jpg`
    ),
    normalScale: 0.45,
    generateNormal: true,
    roughness: 0.85,
  },
  jupiter: {
    map: chain(`${LOCAL}/2k_jupiter.jpg`, `${SSS}/2k_jupiter.jpg`, `${ART}/jupiter.jpg`),
    generateNormal: false,
    roughness: 0.72,
  },
  saturn: {
    map: chain(`${LOCAL}/2k_saturn.jpg`, `${SSS}/2k_saturn.jpg`),
    generateNormal: false,
    roughness: 0.74,
  },
  saturn_ring: {
    map: chain(
      `${LOCAL}/2k_saturn_ring_alpha.png`,
      `https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_saturn_ring_alpha.png`,
      `${SSS}/2k_saturn_ring_alpha.png`
    ),
    generateNormal: false,
  },
  uranus: {
    map: chain(`${LOCAL}/2k_uranus.jpg`, `${SSS}/2k_uranus.jpg`),
    generateNormal: false,
    roughness: 0.7,
  },
  neptune: {
    map: chain(`${LOCAL}/2k_neptune.jpg`, `${SSS}/2k_neptune.jpg`),
    generateNormal: false,
    roughness: 0.7,
  },
  pluto: {
    map: chain(`${LOCAL}/2k_pluto.jpg`, `${ART}/pluto.jpg`, `${SSS}/2k_pluto.jpg`),
    normalScale: 0.38,
    generateNormal: true,
    roughness: 0.86,
  },
  eris: {
    map: chain(
      `${LOCAL}/2k_eris.jpg`,
      `${SSS}/2k_eris.jpg`,
      `${SSS}/2k_eris_fictional.jpg`
    ),
    normalScale: 0.3,
    generateNormal: true,
    roughness: 0.88,
  },
  makemake: {
    map: chain(
      `${LOCAL}/2k_makemake.jpg`,
      `${SSS}/2k_makemake_fictional.jpg`
    ),
    normalScale: 0.3,
    generateNormal: true,
    roughness: 0.88,
  },
  haumea: {
    map: chain(
      `${LOCAL}/2k_haumea.jpg`,
      `${SSS}/2k_haumea_fictional.jpg`
    ),
    normalScale: 0.28,
    generateNormal: true,
    roughness: 0.88,
  },
  quaoar: {
    map: chain(`${LOCAL}/2k_ceres.jpg`, `${SSS}/2k_ceres_fictional.jpg`),
    normalScale: 0.32,
    generateNormal: true,
    roughness: 0.87,
  },
  orcus: {
    map: chain(`${LOCAL}/2k_ceres.jpg`, `${SSS}/2k_ceres_fictional.jpg`),
    normalScale: 0.32,
    generateNormal: true,
    roughness: 0.87,
  },
  sedna: {
    map: chain(`${LOCAL}/2k_ceres.jpg`, `${SSS}/2k_ceres_fictional.jpg`),
    normalScale: 0.3,
    generateNormal: true,
    roughness: 0.88,
  },
};

export function getPlanetTextureConfig(planetId) {
  return PLANET_TEXTURE_SETS[planetId] ?? null;
}
