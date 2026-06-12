import * as THREE from 'three';
import {
  sampleOrbitRingPositions,
  computeCircularOrbitRingSegments,
  trueAnomalyFromHeliocentricXZ,
} from './astroTime.js';
import { createExoPlanetTextures } from './textures.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export function createStarfield(count = 12000) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = 8000 + Math.random() * 12000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const tint = 0.6 + Math.random() * 0.4;
    const hue = Math.random();
    if (hue < 0.15) {
      colors[i * 3] = 0.7 * tint;
      colors[i * 3 + 1] = 0.85 * tint;
      colors[i * 3 + 2] = 1.0 * tint;
    } else if (hue < 0.3) {
      colors[i * 3] = 1.0 * tint;
      colors[i * 3 + 1] = 0.95 * tint;
      colors[i * 3 + 2] = 0.8 * tint;
    } else {
      colors[i * 3] = tint;
      colors[i * 3 + 1] = tint;
      colors[i * 3 + 2] = tint;
    }
    sizes[i] = 0.5 + Math.random() * 2.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, a * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(geo, mat);
  stars.name = 'starfield';
  return stars;
}

const SUN_SHADER_CHUNK = `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }
`;

export function createSunSurfaceMaterial(map = null) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: map },
      uUseMap: { value: map ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uMap;
      uniform float uUseMap;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      ${SUN_SHADER_CHUNK}
      vec2 sphereUv(vec3 n) {
        return vec2(
          atan(n.z, n.x) / 6.28318530718 + 0.5,
          acos(clamp(n.y, -1.0, 1.0)) / 3.14159265359
        );
      }
      vec3 sampleSunMap(vec2 uv) {
        vec3 c = texture2D(uMap, uv).rgb;
        float seam = smoothstep(0.992, 1.0, uv.x) + smoothstep(0.008, 0.0, uv.x);
        vec3 wrap = texture2D(uMap, vec2(fract(uv.x + 0.5), uv.y)).rgb;
        return mix(c, (c + wrap) * 0.5, seam * 0.65);
      }
      void main() {
        float mu = max(dot(vNormal, vViewDir), 0.0);
        float limb = pow(mu, 0.38);
        float t = uTime * 0.03;
        vec3 col;

        if (uUseMap > 0.5) {
          col = sampleSunMap(vUv);
          vec2 suv = sphereUv(normalize(vWorldNormal));
          float granule = fbm(suv * 14.0 + vec2(t * 0.03, -t * 0.025)) * 0.045;
          col = col * (0.96 + granule);
          col *= mix(0.9, 1.04, limb);
          col += col * pow(1.0 - mu, 1.6) * 0.08;
        } else {
          vec2 suv = sphereUv(normalize(vWorldNormal));
          vec2 uv = suv * vec2(5.0, 2.5);
          float coarse = fbm(uv * 4.5 - t * 0.12);
          float granule = fbm(uv * 14.0 + vec2(t * 0.05, -t * 0.04));
          float surface = smoothstep(0.28, 0.72, coarse * 0.55 + granule * 0.45);
          vec3 photosphere = vec3(1.0, 0.68, 0.22);
          vec3 chromosphere = vec3(0.88, 0.42, 0.12);
          col = mix(chromosphere, photosphere, surface);
          col *= mix(0.78, 1.05, limb);
          col += vec3(0.1, 0.05, 0.015) * pow(1.0 - mu, 2.0);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: true,
  });
}

function createCoronaMaterial(innerColor, outerColor, intensity, power) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: new THREE.Color(innerColor) },
      uOuter: { value: new THREE.Color(outerColor) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uInner;
      uniform vec3 uOuter;
      uniform float uIntensity;
      uniform float uPower;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      ${SUN_SHADER_CHUNK}
      void main() {
        float ndv = max(dot(vNormal, vViewDir), 0.0);
        float fresnel = pow(1.0 - ndv, uPower);
        float ray = fbm(vec2(atan(vNormal.z, vNormal.x) * 3.0, vNormal.y * 4.0 + uTime * 0.06));
        float pulse = 0.96 + 0.04 * sin(uTime * 0.55);
        float alpha = pow(fresnel, 1.85) * uIntensity * (0.82 + ray * 0.18) * pulse;
        alpha *= smoothstep(0.0, 0.22, fresnel);
        vec3 col = mix(uOuter, uInner, pow(fresnel, 0.45));
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function hexToCoronaColors(hex) {
  const c = new THREE.Color(hex);
  const inner = c.clone().lerp(new THREE.Color(0xffffff), 0.45);
  const outer = c.clone().multiplyScalar(0.55);
  return { inner, outer };
}

/** 恒星系内恒星光晕：仅多层 Sprite，避免 BackSide 日冕在近距离变成廉价圆盘 */
export function createExoSystemStarGlow(radius, colorHex) {
  const group = new THREE.Group();
  group.name = 'starGlow';
  const glowTex = createGlowTexture();
  const col = new THREE.Color(colorHex);

  const inner = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: col,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  inner.scale.set(radius * 2.6, radius * 2.6, 1);
  inner.renderOrder = -1;
  group.add(inner);

  const outer = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: col.clone().lerp(new THREE.Color(0xffeedd), 0.35),
      transparent: true,
      opacity: 0.028,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  outer.scale.set(radius * 5.2, radius * 5.2, 1);
  outer.renderOrder = -2;
  group.add(outer);
  return group;
}

/** 银河系总览 / 远景用的粒状日冕（远距离观看） */
export function createExoStarGlow(radius, colorHex) {
  const group = new THREE.Group();
  group.name = 'starGlow';
  const { inner, outer } = hexToCoronaColors(colorHex);

  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.28, 40, 40),
    createCoronaMaterial(inner.getHex(), outer.getHex(), 0.16, 6.5)
  );
  corona.renderOrder = -1;
  group.add(corona);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })
  );
  halo.scale.set(radius * 3.2, radius * 3.2, 1);
  halo.renderOrder = -2;
  group.add(halo);
  return group;
}

export function updateExoStarGlow(group, elapsed) {
  if (!group) return;
  group.traverse((child) => {
    if (child.material?.uniforms?.uTime) {
      child.material.uniforms.uTime.value = elapsed;
    }
  });
}

export function createSunGlow(radius) {
  const group = new THREE.Group();
  group.name = 'sunGlow';
  const glowTex = createGlowTexture();

  const innerHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfff4e0,
      transparent: true,
      opacity: 0.065,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  innerHalo.name = 'innerHalo';
  innerHalo.material.userData.baseOpacity = 0.065;
  innerHalo.scale.set(radius * 2.35, radius * 2.35, 1);
  innerHalo.renderOrder = -1;
  group.add(innerHalo);

  const outerHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd8a0,
      transparent: true,
      opacity: 0.028,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  outerHalo.name = 'outerHalo';
  outerHalo.material.userData.baseOpacity = 0.028;
  outerHalo.scale.set(radius * 3.6, radius * 3.6, 1);
  outerHalo.renderOrder = -2;
  group.add(outerHalo);

  return group;
}

/** 调节太阳日冕亮度：full 聚焦太阳 / dim 聚焦其他天体 / roam 远景漫游 */
export function setSunGlowLevel(glow, level = 'full') {
  if (!glow) return;
  const factor = level === 'dim' ? 0.22 : level === 'roam' ? 0.55 : 1.0;
  glow.traverse((child) => {
    const mat = child.material;
    if (!mat) return;
    if (mat.uniforms?.uIntensity) {
      const base = mat.userData.baseIntensity ?? mat.uniforms.uIntensity.value;
      mat.uniforms.uIntensity.value = base * factor;
    }
    if (mat.userData.baseOpacity !== undefined) {
      mat.opacity = mat.userData.baseOpacity * factor;
    }
  });
}

export function updateSunEffects(sunMesh, elapsed) {
  if (!sunMesh) return;
  const mat = sunMesh.material;
  if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = elapsed;

  const glow = sunMesh.userData.glow;
  if (!glow) return;
  glow.children.forEach((child) => {
    if (child.material?.uniforms?.uTime) {
      child.material.uniforms.uTime.value = elapsed;
    }
  });
}

function createGlowTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.04, 'rgba(255,252,245,0.92)');
  grad.addColorStop(0.12, 'rgba(255,235,200,0.45)');
  grad.addColorStop(0.28, 'rgba(255,190,110,0.12)');
  grad.addColorStop(0.5, 'rgba(255,120,40,0.04)');
  grad.addColorStop(0.72, 'rgba(255,60,10,0.012)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** 轨道线透明度：仅聚焦单颗时显示 */
export const ORBIT_OPACITY = {
  focus: 0.26,
};

const ORBIT_LINE_WIDTH = 1.5;
const ORBIT_COLOR = 0x5a7a92;
const orbitLineMaterials = new Set();

export function updateOrbitLineResolution(width, height) {
  orbitLineMaterials.forEach((mat) => mat.resolution.set(width, height));
}

function createOrbitLineMaterial(color = ORBIT_COLOR, opacity = ORBIT_OPACITY.focus) {
  const mat = new LineMaterial({
    color,
    linewidth: ORBIT_LINE_WIDTH,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    alphaToCoverage: true,
  });
  mat.resolution.set(innerWidth, innerHeight);
  orbitLineMaterials.add(mat);
  return mat;
}

function buildOrbitLine2(positions, color, opacity) {
  const geo = new LineGeometry();
  geo.setPositions(positions);
  const line = new Line2(geo, createOrbitLineMaterial(color, opacity));
  line.computeLineDistances();
  line.frustumCulled = false;
  line.renderOrder = 5;
  return line;
}

export function setOrbitRingStyle(line, { visible = true, opacity = ORBIT_OPACITY.focus } = {}) {
  if (!line) return;
  line.visible = visible;
  if (line.material && opacity != null) {
    line.material.opacity = opacity;
    line.material.needsUpdate = true;
  }
}

export function createOrbitRing(radius, color = ORBIT_COLOR) {
  const positions = [];
  const segments = computeCircularOrbitRingSegments(radius);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  const line = buildOrbitLine2(positions, color, ORBIT_OPACITY.focus);
  line.name = 'orbitRing';
  return line;
}

/** 椭圆轨道可视化（半长轴 a·scale，偏心率 e，近日点黄经 varpiDeg°） */
export function createEllipseOrbitRing(aAU, e, scale, color = ORBIT_COLOR, varpiDeg = 0) {
  const positions = sampleOrbitRingPositions(aAU, e, varpiDeg, scale);
  const line = buildOrbitLine2(positions, color, ORBIT_OPACITY.focus);
  line.name = 'orbitRing';
  return line;
}

/** 将行星当前位置嵌入轨道折线，确保聚焦时轨道穿过球心 */
export function alignOrbitRingToPlanet(line, aAU, e, varpiDeg, scale, planetX, planetZ) {
  if (!line?.geometry) return;
  const insertNu = trueAnomalyFromHeliocentricXZ(aAU, e, varpiDeg, planetX, planetZ);
  const positions = sampleOrbitRingPositions(aAU, e, varpiDeg, scale, undefined, insertNu);
  line.geometry.setPositions(positions);
  line.computeLineDistances();
}

/** 将当前角度嵌入圆形轨道（月球等地心轨道） */
export function alignOrbitRingToAngle(line, radius, angle) {
  if (!line?.geometry) return;
  const TWO_PI = Math.PI * 2;
  const segments = computeCircularOrbitRingSegments(radius);
  const nuList = [];
  for (let i = 0; i <= segments; i++) nuList.push((i / segments) * TWO_PI);
  const ins = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  if (!nuList.some((nu) => Math.abs(nu - ins) < 1e-5)) {
    nuList.push(ins);
    nuList.sort((a, b) => a - b);
  }
  const positions = [];
  for (const a of nuList) {
    positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  }
  line.geometry.setPositions(positions);
  line.computeLineDistances();
}

/** 柔和圆形粒子材质（避免 WebGL 默认方块点） */
export function createSoftPointsMaterial({ opacity = 0.5, sizeFactor = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uSizeFactor: { value: sizeFactor },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uSizeFactor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uSizeFactor * (260.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.08, d);
        float halo = smoothstep(0.5, 0.22, d) * 0.35;
        gl_FragColor = vec4(vColor, (core + halo) * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** 柯伊伯带粒子环（30–55 AU，柔和星尘感） */
export function createKuiperBelt(scale = 80) {
  const inner = 30 * scale;
  const outer = 55 * scale;
  const count = 900;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const c1 = new THREE.Color(0x6a7a96);
  const c2 = new THREE.Color(0x3d4a62);

  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const r = inner + t * (outer - inner);
    const angle = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 80;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * r;
    const c = c1.clone().lerp(c2, t * 0.6 + Math.random() * 0.2);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = 0.35 + Math.random() * 1.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const belt = new THREE.Points(geo, createSoftPointsMaterial({ opacity: 0.42, sizeFactor: 2.2 }));
  belt.name = 'kuiperBelt';
  belt.renderOrder = -2;
  return belt;
}

/** 径向环纹理：U=半径，V 固定采样纹理中线（SSS / 程序纹理均为径向条带） */
function remapRingRadialUv(geometry, innerRadius, outerRadius) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.sqrt(v.x * v.x + v.y * v.y);
    uv.setXY(i, (r - innerRadius) / (outerRadius - innerRadius), 0.5);
  }
  uv.needsUpdate = true;
}

function enhanceRingTexture(tex) {
  if (!tex) return null;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createSaturnRingMaterial(ringMap) {
  const map = enhanceRingTexture(ringMap);
  if (!map) return null;
  return new THREE.MeshBasicMaterial({
    map,
    alphaMap: map,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: true,
  });
}

export function applySaturnRingTexture(ringGroup, ringMap) {
  if (!ringGroup || !ringMap) return;
  const mat = createSaturnRingMaterial(ringMap);
  if (!mat) return;
  ringGroup.traverse((child) => {
    if (!child.isMesh || child.name !== 'saturnRingMesh') return;
    const old = child.material;
    child.material = mat;
    if (old?.dispose) old.dispose();
  });
}

export function createSaturnRings(planetRadius, ringMap) {
  const group = new THREE.Group();
  group.name = 'saturnRings';

  const inner = planetRadius * 1.2;
  const outer = planetRadius * 2.48;
  const geo = new THREE.RingGeometry(inner, outer, 128, 12);
  remapRingRadialUv(geo, inner, outer);

  const mat = createSaturnRingMaterial(ringMap);
  if (!mat) return group;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'saturnRingMesh';
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  group.add(mesh);
  return group;
}

export function setupPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.24,
    0.26,
    0.97
  );
  bloom.resolution.set(
    Math.max(320, Math.floor(window.innerWidth * 0.55)),
    Math.max(240, Math.floor(window.innerHeight * 0.55))
  );
  composer.addPass(bloom);
  return { composer, bloom };
}

export function createExoPlanetMaterial(planet, systemId) {
  const { map, normalMap } = createExoPlanetTextures(planet, systemId);
  const isGiant = planet.radiusKm > 15000 || planet.a > 1.5;
  const isHot = planet.a < 0.12;
  const isHz = !isGiant && !isHot && planet.a >= 0.35 && planet.a <= 1.4;
  const base = new THREE.Color(planet.color);

  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(isGiant ? 0.48 : 0.62, isGiant ? 0.48 : 0.62),
    color: 0xffffff,
    roughness: isGiant ? 0.46 : isHot ? 0.74 : 0.66,
    metalness: isGiant ? 0.06 : 0.03,
    emissive: new THREE.Color(0x1e3048).lerp(base, isHz ? 0.22 : isHot ? 0.18 : 0.14),
    emissiveIntensity: isHz ? 0.22 : isHot ? 0.24 : isGiant ? 0.16 : 0.2,
  });
}

/** 系外行星不使用实体大气壳（近距离会像廉价塑料圈），夜面靠 emissive 补光 */
export function attachExoAtmosphere() {}

export function createExoStarMaterial(colorHex) {
  const col = new THREE.Color(colorHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: col },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDir;
      ${SUN_SHADER_CHUNK}
      void main() {
        float mu = max(dot(vNormal, vViewDir), 0.0);
        vec2 uv = vUv * 5.0;
        float granule = fbm(uv * 9.0 + uTime * 0.035);
        float limb = pow(mu, 0.28);
        vec3 hot = uColor * 1.4 + vec3(0.18, 0.12, 0.03);
        vec3 col = mix(uColor * 0.32, hot, limb * (0.62 + granule * 0.38));
        col += uColor * pow(1.0 - mu, 2.8) * 0.14;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: true,
  });
}

/** 银河系总览恒星光点（粒状核心 + 日冕 + 多层光晕） */
export function createOverviewStarMarker(colorHex, size = 200) {
  const group = new THREE.Group();
  group.name = 'overviewStar';
  const coreR = size * 0.11;
  const glow = createExoStarGlow(coreR, colorHex);
  glow.scale.set(2.4, 2.4, 2.4);
  group.add(glow);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(coreR, 36, 36),
    createExoStarMaterial(colorHex)
  );
  core.name = 'overviewStarCore';
  core.renderOrder = 4;
  group.add(core);

  const col = new THREE.Color(colorHex);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: col,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })
  );
  halo.scale.set(size * 1.35, size * 1.35, 1);
  halo.renderOrder = 1;
  group.add(halo);

  const outer = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: col.clone().lerp(new THREE.Color(0x8899ff), 0.18),
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })
  );
  outer.scale.set(size * 2.1, size * 2.1, 1);
  outer.renderOrder = 0;
  group.add(outer);

  return group;
}

export function createSunLight() {
  // 太阳系尺度下不能用物理平方反比(decay=2)，否则远端行星全黑；衰减略提高以保留明暗交界
  const light = new THREE.PointLight(0xfff4e8, 6.5, 0, 0.1);
  light.castShadow = false;
  return light;
}

export function createAmbientFill() {
  return new THREE.AmbientLight(0x425878, 0.15);
}

export function createHemisphereLight() {
  return new THREE.HemisphereLight(0x6a8ec0, 0x3a4a68, 0.22);
}

export function createFocusFillLight() {
  const light = new THREE.DirectionalLight(0xb8cce8, 0);
  light.position.set(0.15, 0.2, 1);
  return light;
}
