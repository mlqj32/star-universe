/** 日心椭圆轨道 + 自转（J2000 轨道根数） */

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const TWO_PI = Math.PI * 2;
const SIDEREAL_DAY_H = 23.9344696;
const DEG = Math.PI / 180;

/**
 * J2000 轨道根数：a(AU) e 偏心率 L0 平黄经(°) varpi 近日点黄经(°) period(天)
 */
export const ORBITAL_ELEMENTS = {
  mercury: { a: 0.387, e: 0.2056, L0: 252.25, varpi: 77.46, period: 87.969 },
  venus: { a: 0.723, e: 0.0067, L0: 181.98, varpi: 131.53, period: 224.701 },
  earth: { a: 1.0, e: 0.0167, L0: 100.46, varpi: 102.94, period: 365.256 },
  mars: { a: 1.524, e: 0.0934, L0: 355.43, varpi: 336.04, period: 686.98 },
  jupiter: { a: 5.203, e: 0.0489, L0: 34.4, varpi: 14.33, period: 4332.59 },
  saturn: { a: 9.537, e: 0.0565, L0: 49.94, varpi: 93.05, period: 10759.22 },
  uranus: { a: 19.191, e: 0.0457, L0: 313.23, varpi: 173.01, period: 30685.4 },
  neptune: { a: 30.07, e: 0.0113, L0: 304.88, varpi: 48.12, period: 60189 },
  pluto: { a: 39.482, e: 0.2488, L0: 238.93, varpi: 224.07, period: 90560 },
  eris: { a: 67.78, e: 0.4407, L0: 204.2, varpi: 151.77, period: 203830 },
  makemake: { a: 45.79, e: 0.159, L0: 79.5, varpi: 298.0, period: 112897 },
  haumea: { a: 43.13, e: 0.191, L0: 122.3, varpi: 240.2, period: 103774 },
  quaoar: { a: 43.41, e: 0.0404, L0: 90.5, varpi: 280.1, period: 105366 },
  orcus: { a: 39.17, e: 0.227, L0: 65.0, varpi: 220.5, period: 89620 },
  sedna: { a: 506.8, e: 0.8607, L0: 144.3, varpi: 358.5, period: 4153000 },
};

function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 10; i++) E = M + e * Math.sin(E);
  return E;
}

function trueAnomalyFromMeanAnomaly(M, e) {
  const E = solveKepler(M, e);
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
}

/** 真近点角 → 日心 XZ（与轨道环采样同一公式，含近日点黄经 varpi） */
export function heliocentricXZFromTrueAnomaly(aAU, e, varpiDeg, nu, scale) {
  const varpi = varpiDeg * DEG;
  const oneMinusE2 = 1 - e * e;
  const rAU = (aAU * oneMinusE2) / (1 + e * Math.cos(nu));
  const lon = varpi + nu;
  return {
    x: rAU * Math.cos(lon) * scale,
    y: 0,
    z: rAU * Math.sin(lon) * scale,
    rAU,
    r: rAU * scale,
    longitude: ((lon % TWO_PI) + TWO_PI) % TWO_PI,
  };
}

/** 按轨道尺度自适应分段（2 的幂，避免折线弦偏离球心） */
export function computeOrbitRingSegments(aAU, scale, e = 0) {
  const maxR = aAU * scale * (1 + Math.abs(e));
  if (maxR > 15000) return 768;
  if (maxR > 1500) return 384;
  if (maxR > 150) return 192;
  return 96;
}

/** 由日心坐标反求真近点角（与轨道环同一坐标系） */
export function trueAnomalyFromHeliocentricXZ(aAU, e, varpiDeg, x, z) {
  const varpi = varpiDeg * DEG;
  const lon = Math.atan2(z, x);
  return ((lon - varpi) % TWO_PI + TWO_PI) % TWO_PI;
}

export function computeCircularOrbitRingSegments(radius) {
  return Math.min(192, Math.max(64, Math.round(radius * 1.5)));
}

/** 通用椭圆轨道位置（适用于系外行星） */
export function getEllipticOrbitPosition(el, date = new Date(), scale = 1) {
  const days = daysSinceJ2000(date);
  const M0 = (el.L0 - el.varpi) * DEG;
  const M = M0 + (TWO_PI * days) / el.period;
  const Mnorm = ((M % TWO_PI) + TWO_PI) % TWO_PI;
  const nu = trueAnomalyFromMeanAnomaly(Mnorm, el.e);
  const pos = heliocentricXZFromTrueAnomaly(el.a, el.e, el.varpi, nu, scale);
  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    longitude: pos.longitude,
    rAU: pos.rAU,
  };
}

export function daysSinceJ2000(date = new Date()) {
  return (date.getTime() - J2000_MS) / 86400000;
}

/** 椭圆轨道可视化采样点（与 getHeliocentricPosition 同一坐标系） */
export function sampleOrbitRingPositions(aAU, e, varpiDeg, scale, segments, insertNu = null) {
  const n = segments ?? computeOrbitRingSegments(aAU, scale, e);
  const nuList = [];
  for (let i = 0; i <= n; i++) nuList.push((i / n) * TWO_PI);
  if (insertNu != null) {
    const ins = ((insertNu % TWO_PI) + TWO_PI) % TWO_PI;
    const dup = nuList.some(
      (nu) => Math.abs(nu - ins) < 1e-5 || Math.abs(nu - ins - TWO_PI) < 1e-5
    );
    if (!dup) {
      nuList.push(ins);
      nuList.sort((a, b) => a - b);
    }
  }
  const positions = [];
  for (const nu of nuList) {
    const p = heliocentricXZFromTrueAnomaly(aAU, e, varpiDeg, nu, scale);
    positions.push(p.x, p.y, p.z);
  }
  return positions;
}

/** 日心椭圆位置（黄道面 XZ） */
export function getHeliocentricPosition(planetId, date = new Date(), scale = 80) {
  const el = ORBITAL_ELEMENTS[planetId];
  if (!el) return { x: 0, y: 0, z: 0, r: 0, longitude: 0, rAU: 0 };

  const days = daysSinceJ2000(date);
  const M0 = (el.L0 - el.varpi) * DEG;
  const M = M0 + (TWO_PI * days) / el.period;
  const Mnorm = ((M % TWO_PI) + TWO_PI) % TWO_PI;

  const nu = trueAnomalyFromMeanAnomaly(Mnorm, el.e);
  const pos = heliocentricXZFromTrueAnomaly(el.a, el.e, el.varpi, nu, scale);

  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    r: pos.r,
    longitude: pos.longitude,
    rAU: pos.rAU,
    a: el.a,
    e: el.e,
  };
}

/** @deprecated 使用 getHeliocentricPosition().longitude */
export function getPlanetOrbitAngle(planetId, periodDays, date = new Date()) {
  return getHeliocentricPosition(planetId, date, 1).longitude;
}

export function getEarthSpinAngle(date = new Date()) {
  const days = daysSinceJ2000(date);
  const ut =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000;
  const totalH = Math.floor(days) * 24 + ut + (days % 1) * 24;
  return ((totalH / SIDEREAL_DAY_H) * TWO_PI) % TWO_PI;
}

export function getEarthMeshRotation(date = new Date(), orbitLongitude = 0) {
  const ut =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000;
  const solar = (ut / 24) * TWO_PI;
  return solar - orbitLongitude;
}

/**
 * 地心黄道经度（Meeus 简化 lunar 级数，对齐 JPL 约 ±2°）
 * 用于月球绕地公转角，黄道面 XZ 投影。
 */
export function getMoonGeocentricEclipticLongitude(date = new Date()) {
  const d = daysSinceJ2000(date);
  const T = d / 36525;

  const Lp = (218.3164477 + 481267.88123421 * T - 0.0015786 * T * T) * DEG;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * DEG;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * DEG;
  const Mm = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * DEG;
  const F = (93.272095 + 483202.0175233 * T - 0.0036539 * T * T) * DEG;

  let lon = Lp;
  lon += (6.289 * Math.sin(Mm)) * DEG;
  lon += (1.274 * Math.sin(2 * D - Mm)) * DEG;
  lon += (0.658 * Math.sin(2 * D)) * DEG;
  lon += (0.214 * Math.sin(2 * Mm)) * DEG;
  lon += (-0.186 * Math.sin(M)) * DEG;
  lon += (0.114 * Math.sin(2 * F)) * DEG;
  lon += (0.059 * Math.sin(2 * D - 2 * Mm)) * DEG;
  lon += (0.057 * Math.sin(2 * D - M - Mm)) * DEG;
  lon += (0.053 * Math.sin(2 * D + Mm)) * DEG;
  lon += (0.046 * Math.sin(2 * D - M)) * DEG;
  lon += (0.041 * Math.sin(M - Mm)) * DEG;
  lon += (-0.035 * Math.sin(D)) * DEG;
  lon += (-0.031 * Math.sin(M + Mm)) * DEG;
  lon += (-0.015 * Math.sin(2 * F - Mm)) * DEG;

  return ((lon % TWO_PI) + TWO_PI) % TWO_PI;
}

export function getMoonOrbitAngle(date = new Date()) {
  return getMoonGeocentricEclipticLongitude(date);
}

export function getAxialSpinAngle(rotationHours, date = new Date()) {
  const days = daysSinceJ2000(date);
  const ut =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const totalH = Math.floor(days) * 24 + ut;
  return ((totalH / rotationHours) * TWO_PI) % TWO_PI;
}

export function formatSimTime(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}
