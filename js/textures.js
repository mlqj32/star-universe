import * as THREE from 'three';

function noise2D(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(x, y, octaves = 5, seed = 0) {
  let v = 0;
  let a = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    v += a * noise2D(fx, fy, seed + i * 17);
    fx *= 2;
    fy *= 2;
    a *= 0.5;
  }
  return v;
}

function makeCanvas(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 土星环径向剖面（卡西尼缝 + 颗粒噪点） */
export function createProceduralSaturnRingTexture() {
  const tex = makeCanvas(1024, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      let alpha = 0;
      let r = 210;
      let g = 185;
      let b = 150;
      if (t > 0.1 && t < 0.24) {
        alpha = 0.55 + fbm(t * 40, 0, 3, 3) * 0.25;
      } else if (t > 0.28 && t < 0.43) {
        alpha = 0.82 + fbm(t * 55, 1, 4, 7) * 0.15;
        r = 228;
        g = 205;
        b = 168;
      } else if (t > 0.435 && t < 0.455) {
        alpha = 0.04;
      } else if (t > 0.46 && t < 0.74) {
        alpha = 0.72 + fbm(t * 48, 2, 4, 11) * 0.2;
        r = 200;
        g = 178;
        b = 145;
      } else if (t > 0.76 && t < 0.92) {
        alpha = 0.35 + fbm(t * 30, 3, 3, 19) * 0.2;
      }
      for (let y = 0; y < h; y++) {
        const grain = fbm(x * 0.04, y * 0.35, 3, 23) * 0.12;
        const i = (y * w + x) * 4;
        const a = Math.min(255, Math.floor((alpha + grain) * 255));
        img.data[i] = Math.min(255, r + grain * 40);
        img.data[i + 1] = Math.min(255, g + grain * 35);
        img.data[i + 2] = Math.min(255, b + grain * 28);
        img.data[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 等距柱状太阳表面（与球面法线采样匹配，无极点放射伪影） */
export function createProceduralSunTexture() {
  const tex = makeCanvas(1024, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      const theta = v * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const phi = u * Math.PI * 2;
        const sx = sinT * Math.cos(phi);
        const sy = cosT;
        const sz = sinT * Math.sin(phi);
        const granule = fbm(sx * 9 + sy * 2, sz * 9 + sy * 2, 6, 42);
        const fine = fbm(sx * 24 + 3, sz * 24 - 1, 4, 17);
        const cell = fbm(sx * 5.5 + sz * 4, sy * 8, 3, 88);
        const surface = granule * 0.58 + fine * 0.28 + cell * 0.14;
        const spot = Math.pow(fbm(sx * 2.8 + 40, sz * 2.8 - 20, 3, 99), 2.2);
        const limb = 0.82 + 0.18 * Math.abs(sy);
        let r = (238 + surface * 28 - spot * 32) * limb;
        let g = (152 + surface * 55 - spot * 18) * limb;
        let b = (42 + surface * 35 - spot * 8) * limb;
        const i = (y * w + x) * 4;
        img.data[i] = Math.min(255, r);
        img.data[i + 1] = Math.min(255, g);
        img.data[i + 2] = Math.min(255, b);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createProceduralTexture(planetId) {
  switch (planetId) {
    case 'sun':
      return createProceduralSunTexture();

    case 'mercury':
      return makeCanvas(512, 256, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = fbm(x * 0.015, y * 0.015, 5, 3);
            const c = 90 + n * 80;
            img.data[i] = c;
            img.data[i + 1] = c;
            img.data[i + 2] = c + 10;
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'venus':
      return makeCanvas(512, 256, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = fbm(x * 0.008, y * 0.008, 6, 7);
            img.data[i] = 200 + n * 40;
            img.data[i + 1] = 170 + n * 50;
            img.data[i + 2] = 100 + n * 30;
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'mars':
      return makeCanvas(1024, 512, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = fbm(x * 0.018, y * 0.018, 6, 11);
            const ice = fbm(x * 0.04, y * 0.04, 3, 99);
            if (y < h * 0.1 && ice > 0.5) {
              img.data[i] = 230; img.data[i + 1] = 220; img.data[i + 2] = 210;
            } else {
              img.data[i] = 160 + n * 90;
              img.data[i + 1] = 55 + n * 45;
              img.data[i + 2] = 25 + n * 25;
            }
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'jupiter':
      return makeCanvas(1024, 512, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const band = Math.sin(y * 0.055 + fbm(x * 0.012, y * 0.006, 3) * 3.5) * 0.5 + 0.5;
            const turb = fbm(x * 0.025, y * 0.025, 4, 21);
            if (Math.abs(y - h * 0.42) < 22 && Math.abs(x - w * 0.55) < 50) {
              img.data[i] = 195; img.data[i + 1] = 95; img.data[i + 2] = 50;
            } else {
              img.data[i] = 175 + band * 65 + turb * 35;
              img.data[i + 1] = 115 + band * 50 + turb * 25;
              img.data[i + 2] = 65 + band * 35;
            }
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'saturn':
      return makeCanvas(512, 256, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const band = Math.sin(y * 0.06 + fbm(x * 0.008, y * 0.004, 3) * 2) * 0.5 + 0.5;
            img.data[i] = 210 + band * 30;
            img.data[i + 1] = 190 + band * 25;
            img.data[i + 2] = 150 + band * 20;
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'uranus':
      return makeCanvas(512, 256, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = fbm(x * 0.01, y * 0.01, 4, 31);
            img.data[i] = 120 + n * 40;
            img.data[i + 1] = 200 + n * 50;
            img.data[i + 2] = 210 + n * 30;
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'neptune':
      return makeCanvas(512, 256, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = fbm(x * 0.012, y * 0.012, 5, 41);
            const band = Math.sin(y * 0.05) * 0.15;
            img.data[i] = 30 + n * 40 + band * 50;
            img.data[i + 1] = 60 + n * 60 + band * 40;
            img.data[i + 2] = 180 + n * 50;
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'eris':
    case 'makemake':
    case 'haumea':
    case 'quaoar':
    case 'orcus':
    case 'sedna':
    case 'pluto':
      return makeCanvas(512, 256, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = fbm(x * 0.018, y * 0.018, 5, 91);
            const heart =
              Math.pow(1 - Math.min(1, Math.hypot((x - w * 0.38) / (w * 0.14), (y - h * 0.42) / (h * 0.12))), 2) * 0.55;
            const dark = fbm(x * 0.04, y * 0.04, 3, 17) < 0.42 ? 0.18 : 0;
            const r = 170 + n * 45 + heart * 55 - dark * 80;
            const g = 155 + n * 40 + heart * 45 - dark * 70;
            const b = 135 + n * 35 + heart * 20 - dark * 60;
            img.data[i] = Math.min(255, r);
            img.data[i + 1] = Math.min(255, g);
            img.data[i + 2] = Math.min(255, b);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'moon':
      return makeCanvas(1024, 512, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = fbm(x * 0.02, y * 0.02, 6, 51);
            const crater = fbm(x * 0.06, y * 0.06, 3, 77);
            const mare = fbm(x * 0.008, y * 0.008, 4, 33);
            let c = 145 + n * 70;
            if (mare < 0.38) c -= 35;
            if (crater > 0.7) c -= 50;
            img.data[i] = c;
            img.data[i + 1] = c;
            img.data[i + 2] = c + 8;
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    case 'earth':
      return makeCanvas(2048, 1024, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const lat = (y / h - 0.5) * 180;
            const lon = (x / w) * 360 - 180;
            const land = fbm(lon * 0.045, lat * 0.035, 6, 61)
              + fbm(lon * 0.12, lat * 0.09, 3, 88) * 0.35;
            const isPolar = Math.abs(lat) > 72;
            if (isPolar) {
              img.data[i] = 245; img.data[i + 1] = 248; img.data[i + 2] = 252;
            } else if (land > 0.48) {
              img.data[i] = 34 + land * 55;
              img.data[i + 1] = 95 + land * 75;
              img.data[i + 2] = 28 + land * 25;
            } else {
              img.data[i] = 8;
              img.data[i + 1] = 55 + land * 40;
              img.data[i + 2] = 145 + land * 50;
            }
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      });

    default:
      return null;
  }
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function parseHex(hex) {
  const c = new THREE.Color(hex);
  return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
}

/** 系外行星程序化表面（岩石 / 气态纹理解析自轨道与半径） */
/** 由漫反射贴图生成法线贴图（无专用法线时的回退） */
export function generateNormalFromDiffuse(sourceTex, strength = 1.4) {
  const img = sourceTex?.image;
  if (!img?.width || !img?.height) return null;

  const maxW = 1024;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.max(2, Math.round(img.width * scale));
  const h = Math.max(2, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);

  const heightAt = (x, y) => {
    const i = (y * w + x) * 4;
    const r = src.data[i];
    const g = src.data[i + 1];
    const b = src.data[i + 2];
    return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : w - 1;
      const xr = x < w - 1 ? x + 1 : 0;
      const yt = y > 0 ? y - 1 : h - 1;
      const yb = y < h - 1 ? y + 1 : 0;
      const dx = (heightAt(xr, y) - heightAt(xl, y)) * strength;
      const dy = (heightAt(x, yb) - heightAt(x, yt)) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * w + x) * 4;
      out.data[i] = Math.round((nx / len) * 0.5 * 255 + 128);
      out.data[i + 1] = Math.round((ny / len) * 0.5 * 255 + 128);
      out.data[i + 2] = Math.round((nz / len) * 0.5 * 255 + 128);
      out.data[i + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createExoPlanetTextures(planet, systemId) {
  const seed = hashSeed(`${systemId}:${planet.id}`);
  const base = parseHex(planet.color);
  const isGiant = planet.radiusKm > 15000 || planet.a > 1.5;
  const isHot = planet.a < 0.12;

  const map = makeCanvas(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const u = x / w;
        const v = y / h;
        const n = fbm(u * (isGiant ? 10 : 18), v * (isGiant ? 6 : 14), 5, seed);
        const band = isGiant ? Math.sin(v * Math.PI * (5 + (seed % 3)) + n * 2) * 0.5 + 0.5 : n;
        const shade = isGiant ? 0.55 + band * 0.45 : 0.4 + n * 0.55;
        const heat = isHot ? 1.12 : 1;
        img.data[i] = Math.min(255, base.r * shade * heat + n * 18);
        img.data[i + 1] = Math.min(255, base.g * shade * (isHot ? 0.85 : 1) + n * 12);
        img.data[i + 2] = Math.min(255, base.b * shade * (isHot ? 0.7 : 1) + n * 10);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const normalMap = makeCanvas(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const n =
          fbm((x / w) * 24, (y / h) * 24, 4, seed + 11) * 0.5 +
          fbm((x / w) * 48, (y / h) * 48, 3, seed + 29) * 0.25;
        const g = Math.floor(128 + (n - 0.5) * 90);
        img.data[i] = g;
        img.data[i + 1] = g;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  return { map, normalMap };
}
