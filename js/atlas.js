import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Astronomy from '../vendor/astronomy.js';
import { worlds, worldById } from './world.js?v=20261024-distance-fix';
import { endpointNotes, solarPairNotes } from './distanceNarratives.js?v=20261024-distance-fix';
import { canonPairAssessments } from './canonRelations.js?v=20261024-distance-fix';

const $ = (selector) => document.querySelector(selector);
const PLANET_RADIUS = 4.2;
const STAR_RADIUS = PLANET_RADIUS * 1.7;
const LOCAL_SYSTEM_SCALE = 1.45;
const TWO_PI = Math.PI * 2;
const DAY_MS = 86400000;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DISPLAY_UNITS_PER_AU = 80;
const AU_PER_LIGHT_YEAR = 63241.077084;
const AU_TO_LIGHT_YEAR = 1 / AU_PER_LIGHT_YEAR;
const KILOMETERS_PER_AU = 149597870.7;
const SOLAR_BODIES = {
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  cangyan: Astronomy.Body.Earth,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
};
const J2000_OBLIQUITY = THREE.MathUtils.degToRad(23.43929111);
// 跨星系距离与局部公转轨道共用同一空间比例，放大时不把光年压成数个 AU。
const GALAXY_SYSTEM_SCALE = DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE * AU_PER_LIGHT_YEAR;
const KILOMETERS_PER_LIGHT_YEAR = 9.460730472e12;
// 帕克太阳探测器约 192 km/s 的峰值日心速度，仅用于给出极度乐观的机器人飞行下限。
const FASTEST_HUMAN_MADE_SPEED_KM_S = 192;
const FASTEST_CRAFT_YEARS_PER_LIGHT_YEAR = KILOMETERS_PER_LIGHT_YEAR / FASTEST_HUMAN_MADE_SPEED_KM_S / (365.25 * DAY_MS / 1000);
const canvas = $('#space');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#040914');
scene.fog = new THREE.FogExp2('#040914', .00066);
const camera = new THREE.PerspectiveCamera(46, 1, .1, 1e12);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .06;
controls.enablePan = true;
controls.enableZoom = true;
controls.rotateSpeed = 1.1;
controls.zoomSpeed = 1.5;
controls.panSpeed = 1.2;
controls.screenSpacePanning = true;
controls.minDistance = 8;
controls.maxDistance = 120000;
controls.minPolarAngle = Math.PI * .08;
controls.maxPolarAngle = Math.PI * .92;

// 深空背景随镜头朝向采样天球；仅平移镜头不会放大近乎无限远的背景星。
const spaceBackground = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uIntensity: { value: 1 },
      uInverseProjection: { value: new THREE.Matrix4() },
      uCameraRotation: { value: new THREE.Matrix3() },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * .5 + .5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec2 uResolution;
      uniform mat4 uInverseProjection;
      uniform mat3 uCameraRotation;
      varying vec2 vUv;

      #define PI 3.14159265359

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = .52;
        mat2 rotation = mat2(.86, -.5, .5, .86);
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(p);
          p = rotation * p * 2.03 + vec2(13.7, 7.1);
          amplitude *= .5;
        }
        return value;
      }

      float hash31(vec3 p) {
        p = fract(p * .1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i);
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
        float x00 = mix(n000, n100, f.x);
        float x10 = mix(n010, n110, f.x);
        float x01 = mix(n001, n101, f.x);
        float x11 = mix(n011, n111, f.x);
        return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
      }

      float fbm3(vec3 p) {
        float value = 0.0;
        float amplitude = .55;
        mat3 rotation = mat3(
          .86, -.38, .24,
          .42, .9, -.08,
          -.16, .2, .96
        );
        for (int i = 0; i < 2; i++) {
          value += amplitude * noise3(p);
          p = rotation * p * 1.93 + vec3(11.7, 7.1, 4.3);
          amplitude *= .5;
        }
        return value;
      }

      vec2 rotate(vec2 p, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c) * p;
      }

      // 沿视线累积星云密度，制造真正的前后层次和不规则尘埃边缘。
      vec4 raymarchedNebula(vec2 p, float time) {
        vec2 disk = rotate(p, -.18);
        vec3 radiance = vec3(0.0);
        float transmittance = 1.0;
        for (int i = 0; i < 8; i++) {
          float depth = (float(i) + .5) / 8.0;
          vec3 q = vec3(disk.x * 1.65, disk.y * 7.0, -1.85 + depth * 3.7);
          q += vec3(depth * .26, sin(q.x * 1.45 + time * .12) * .14, time * .022);
          float macro = fbm3(q * 1.15);
          float filament = fbm3(q * 4.65 + vec3(4.0, -2.0, 5.0));
          float micro = fbm3(q * 9.2 - vec3(2.0, 5.0, -3.0));
          float dust = smoothstep(.5, .73, noise3(q * 6.4 + vec3(8.0, 1.0, -4.0)));
          float latitude = q.y + (macro - .5) * .7;
          float diskDensity = exp(-pow(abs(latitude) / 1.05, 1.46));
          float knots = smoothstep(.49, .7, filament) * smoothstep(.42, .76, micro);
          float density = smoothstep(.44, .72, macro) * (.3 + knots * 1.04);
          density *= diskDensity * (1.0 - dust * .82);
          float depthFade = smoothstep(.05, .2, depth) * (1.0 - smoothstep(.78, 1.0, depth));
          density *= depthFade;
          float warmDust = smoothstep(.59, .84, macro + filament * .22);
          vec3 emission = mix(
            vec3(.05, .09, .145),
            vec3(.27, .12, .052),
            warmDust
          );
          emission = mix(emission, vec3(.055, .145, .21), smoothstep(.58, .82, filament) * .62);
          float stepAlpha = density * .075;
          radiance += transmittance * emission * stepAlpha;
          transmittance *= 1.0 - stepAlpha * .8;
        }
        return vec4(radiance, 1.0 - transmittance);
      }

      float starLayer(vec2 uv, float scale, float threshold, float softness) {
        vec2 grid = uv * scale;
        vec2 cell = floor(grid);
        vec2 local = fract(grid) - .5;
        float seed = hash21(cell);
        float radius = mix(.012, .042, hash21(cell + 17.3)) * softness;
        float disc = 1.0 - smoothstep(radius * .14, radius, length(local));
        float visible = step(threshold, seed);
        float twinkle = .78 + .22 * sin(uTime * (.35 + seed * 1.7) + seed * 40.0);
        return disc * visible * twinkle * mix(.45, 1.0, hash21(cell + 4.1));
      }

      void main() {
        vec2 ndc = gl_FragCoord.xy / uResolution * 2.0 - 1.0;
        vec4 viewPosition = uInverseProjection * vec4(ndc, 1.0, 1.0);
        vec3 viewRay = normalize(viewPosition.xyz);
        vec3 skyRay = normalize(uCameraRotation * viewRay);
        vec2 p = vec2(atan(skyRay.z, skyRay.x), asin(skyRay.y)) * 1.1;
        float time = uTime * .006;
        vec2 drift = vec2(time * .012, -time * .006);

        // 多尺度深空底色：深蓝、靛紫和极低饱和度的暖色维持真实空间的层次。
        float broad = fbm(p * 1.65 + drift);
        float middle = fbm(rotate(p * 3.2, -.19) - drift * 1.7);
        float fine = fbm(p * 7.5 + vec2(-drift.y, drift.x) * 3.0);
        vec3 color = vec3(.0018, .0042, .014);
        color += vec3(.012, .026, .075) * smoothstep(.28, .74, broad) * .62;
        color += vec3(.018, .014, .052) * smoothstep(.45, .82, middle) * .48;
        color += vec3(.012, .023, .05) * smoothstep(.38, .76, fine) * .42;
        vec4 volume = raymarchedNebula(p, time);
        color += volume.rgb * 4.15;

        // 倾斜银河盘面：由气体云、星尘暗带和中心核共同构成，不是几条透明色带。
        vec2 disk = rotate(p, -.18);
        float warp = (fbm(disk * 2.1 + drift) - .5) * .12;
        float latitude = disk.y + warp;
        float diskWidth = exp(-pow(abs(latitude) / .115, 1.3));
        float cloud = fbm(disk * vec2(3.0, 8.5) + vec2(time * .03, -time * .01));
        float dust = smoothstep(.47, .72, fbm(disk * vec2(7.0, 17.0) - drift * 2.0));
        float filament = smoothstep(.38, .76, cloud) * diskWidth;
        filament *= 1.0 - dust * .58;
        color += vec3(.052, .078, .23) * filament * .62;
        color += vec3(.065, .038, .15) * diskWidth * smoothstep(.38, .76, broad) * .32;
        color += vec3(.028, .065, .15) * diskWidth * smoothstep(.36, .7, middle) * .36;

        // 银河中心的暖色核，压低亮度避免变成霓虹横条。
        float core = exp(-length(vec2(disk.x * .72, latitude * 5.2)) * 2.35);
        core *= smoothstep(.28, .76, cloud + broad * .35);
        color += vec3(.34, .16, .08) * core * .54;
        color += vec3(.13, .12, .32) * exp(-length(vec2(disk.x * .8, latitude * 3.0)) * 3.4) * .46;

        // 三个深度层级的星点：远景细密，中景少而亮，银河内的星点受云气遮蔽。
        float distantStars = starLayer(p + vec2(.17, -.11), 300.0, .91, .82);
        float farStars = starLayer(p * 1.01 + vec2(.23, .18), 480.0, .88, .44);
        float midStars = starLayer(p * 1.01 + vec2(-.03, .09), 138.0, .96, 1.12);
        float nearStars = starLayer(p * 1.03 - vec2(.07, .02), 62.0, .982, 1.55);
        float bandStars = starLayer(disk * vec2(1.0, 1.65) + vec2(.12, -.06), 210.0, .958, .72);
        float starMask = clamp(1.0 - diskWidth * dust * .76, .18, 1.0);
        color += vec3(.38, .48, .82) * distantStars * starMask * .8;
        color += vec3(.2, .28, .5) * farStars * starMask * .58;
        color += vec3(.72, .8, 1.0) * midStars * starMask * 1.25;
        color += vec3(1.0, .78, .56) * nearStars * (1.0 + diskWidth * .75);
        color += vec3(.62, .72, .9) * bandStars * diskWidth * (1.0 - dust * .55) * 1.1;

        // 少量冷色星云结节，让画面有体积而不变成均匀噪点。
        vec2 knotUv = p * vec2(2.0, 4.0) + vec2(.7, -.25);
        float knots = smoothstep(.68, .88, fbm(knotUv + drift * 2.0));
        knots *= smoothstep(.16, .72, diskWidth) * (1.0 - dust * .35);
        color += vec3(.055, .11, .25) * knots * .82;

        float vignette = 1.0 - smoothstep(.42, 1.18, length(p * vec2(.72, .92))) * .28;
        color *= vignette * uIntensity;
        color = max(color, vec3(.0008, .0015, .006) * uIntensity);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }),
);
spaceBackground.frustumCulled = false;
spaceBackground.renderOrder = -1000;
const backgroundScene = new THREE.Scene();
const backgroundCamera = new THREE.Camera();
const backgroundTarget = new THREE.WebGLRenderTarget(1, 1, {
  depthBuffer: false,
  stencilBuffer: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: false,
});
backgroundTarget.texture.colorSpace = THREE.SRGBColorSpace;
backgroundScene.add(spaceBackground);

const backgroundComposite = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: { uMap: { value: backgroundTarget.texture } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * .5 + .5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(uMap, vUv);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }),
);
backgroundComposite.frustumCulled = false;
backgroundComposite.renderOrder = -1000;
scene.add(backgroundComposite);

// 全局光只负责极弱的环境可见度；行星主受光由所属恒星的点光源决定。
const ambientFill = new THREE.AmbientLight('#9ab9c9', .09);
scene.add(ambientFill);
const hemisphereFill = new THREE.HemisphereLight('#6a8ec0', '#3a4a68', .105);
scene.add(hemisphereFill);
const key = new THREE.DirectionalLight('#fff2db', .045);
key.position.set(-30, 18, 38);
scene.add(key);
const rim = new THREE.DirectionalLight('#8fd7e0', .025);
rim.position.set(32, -12, -24);
scene.add(rim);
// 聚焦行星时只抬起背阳面一点点，主亮面仍必须由恒星点光源决定。
const focusFillLight = new THREE.DirectionalLight('#b8cce8', 0);
focusFillLight.position.set(.15, .2, 1);
camera.add(focusFillLight);
scene.add(camera);

const LIGHTING_PRESETS = {
  planet: { ambient: .18, hemisphere: .2, key: .05, rim: .03, exposure: 1.12 },
  star: { ambient: .14, hemisphere: .16, key: .035, rim: .02, exposure: 1.12 },
};

function applySceneLighting() {
  const preset = selectedStar ? LIGHTING_PRESETS.star : LIGHTING_PRESETS.planet;
  const cameraDistance = camera.position.distanceTo(controls.target);
  const farView = THREE.MathUtils.clamp((cameraDistance - 260) / 1100, 0, 1);
  ambientFill.intensity = preset.ambient + farView * .04;
  hemisphereFill.intensity = preset.hemisphere + farView * .04;
  const isPlanetFocus = !selectedStar;
  // 行星聚焦时不再用固定世界方向光模拟主光，避免亮面脱离所属恒星。
  key.intensity = isPlanetFocus ? 0 : preset.key;
  rim.intensity = isPlanetFocus ? 0 : preset.rim;
  focusFillLight.intensity = 0;
  renderer.toneMappingExposure = preset.exposure - farView * .04;
  // Space has no distance fog.
  scene.fog.density = 0;
  galaxyDustMaterial.opacity = 0;
  // Keep the deep-space backdrop dark enough for the focused body to read clearly.
  spaceBackground.material.uniforms.uIntensity.value = .26;
}

let seed = 2121;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function softPointTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.18, 'rgba(255,255,255,.96)');
  gradient.addColorStop(.58, 'rgba(255,255,255,.38)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const pointTexture = softPointTexture();
const starMaterials = new Set();
const ringMaterials = new Set();

function createPlanetRingMaterial({ inner, outer, colorA, colorB, opacity, seed, additive = false, glow = 1, physical = false }) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: inner },
      uOuter: { value: outer },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uOpacity: { value: opacity },
      uSeed: { value: seed },
      uGlow: { value: glow },
      uPhysical: { value: physical ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uInner;
      uniform float uOuter;
      uniform float uOpacity;
      uniform float uSeed;
      uniform float uGlow;
      uniform float uPhysical;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec3 vLocalPosition;

      float hash(float n) {
        return fract(sin(n * 91.37 + uSeed * 17.13) * 43758.5453);
      }

      float noise(float x) {
        float i = floor(x);
        float f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(hash(i), hash(i + 1.0), f);
      }

      void main() {
        vec2 p = vLocalPosition.xy;
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float width = max(uOuter - uInner, 0.001);
        float radial = smoothstep(uInner, uInner + width * .12, radius)
          * (1.0 - smoothstep(uOuter - width * .12, uOuter, radius));
        float normalizedRadius = clamp((radius - uInner) / width, 0.0, 1.0);
        if (uPhysical > .5) {
          float broadBand = noise(radius * 11.0 + uSeed * 7.0);
          float narrowBand = noise(radius * 38.0 + uSeed * 13.0);
          float density = .55 + .3 * broadBand + .15 * narrowBand;
          vec3 dustColor = mix(uColorA, uColorB, clamp(broadBand * .72 + narrowBand * .18, 0.0, 1.0));
          gl_FragColor = vec4(dustColor, radial * density * uOpacity);
          return;
        }
        float slowTime = uTime * .018;
        float segmentNoise = noise(angle * 15.0 + normalizedRadius * 6.0 + slowTime);
        float fineNoise = noise(angle * 48.0 - slowTime * .7 + normalizedRadius * 19.0);
        float luminousBreaks = smoothstep(.16, .62, segmentNoise * .74 + fineNoise * .26);
        float filaments = .72 + .28 * sin(angle * 37.0 + normalizedRadius * 13.0 + uSeed * 4.0);
        float pulse = .86 + .14 * sin(angle * 6.0 + slowTime + uSeed);
        float edgeGlow = pow(1.0 - abs(normalizedRadius * 2.0 - 1.0), .55);
        float alpha = radial * mix(.26, 1.0, luminousBreaks) * filaments * pulse;
        alpha *= mix(.72, 1.0, edgeGlow * uGlow);
        vec3 color = mix(uColorA, uColorB, clamp(normalizedRadius * .72 + luminousBreaks * .25, 0.0, 1.0));
        color += vec3(.18, .12, .12) * edgeGlow * uGlow;
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
  material.userData.baseOpacity = opacity;
  material.userData.baseTransparent = true;
  ringMaterials.add(material);
  return material;
}

function createPlanetRingParticles(bodyRadius) {
  const positions = [];
  const colors = [];
  const particleCount = 460;
  const innerRadius = bodyRadius * 1.17;
  const outerRadius = bodyRadius * 1.62;
  for (let i = 0; i < particleCount; i++) {
    const angle = random() * Math.PI * 2;
    const radius = innerRadius + random() * (outerRadius - innerRadius);
    const wobble = (random() - .5) * bodyRadius * .018;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, wobble);
    const tint = random();
    colors.push(.76 + tint * .24, .57 + tint * .32, .72 + tint * .25);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: pointTexture,
    size: bodyRadius * .028,
    vertexColors: true,
    transparent: true,
    opacity: .58,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    alphaTest: .01,
    toneMapped: false,
  });
  material.userData.baseOpacity = material.opacity;
  material.userData.baseTransparent = true;
  return new THREE.Points(geometry, material);
}

function glowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(.18, inner.replace(/\)$/, ', .65)').replace('rgb(', 'rgba('));
  gradient.addColorStop(.56, outer.replace(/\)$/, ', .18)').replace('rgb(', 'rgba('));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function starCoronaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 245, 1)');
  gradient.addColorStop(.09, 'rgba(255, 252, 232, .96)');
  gradient.addColorStop(.26, 'rgba(255, 224, 148, .54)');
  gradient.addColorStop(.58, 'rgba(255, 174, 88, .18)');
  gradient.addColorStop(1, 'rgba(255, 110, 55, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const starCorona = starCoronaTexture();

function starFlareTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const center = 128;
  const radial = context.createRadialGradient(center, center, 0, center, center, 128);
  radial.addColorStop(0, 'rgba(255,255,255,.98)');
  radial.addColorStop(.08, 'rgba(255,246,214,.76)');
  radial.addColorStop(.22, 'rgba(255,220,154,.2)');
  radial.addColorStop(1, 'rgba(255,190,100,0)');
  context.fillStyle = radial;
  context.fillRect(0, 0, 256, 256);

  const horizontal = context.createLinearGradient(0, center, 256, center);
  horizontal.addColorStop(0, 'rgba(255,240,190,0)');
  horizontal.addColorStop(.42, 'rgba(255,240,190,.07)');
  horizontal.addColorStop(.5, 'rgba(255,255,235,.32)');
  horizontal.addColorStop(.58, 'rgba(255,240,190,.07)');
  horizontal.addColorStop(1, 'rgba(255,240,190,0)');
  context.fillStyle = horizontal;
  context.fillRect(0, center - 2, 256, 4);

  const vertical = context.createLinearGradient(center, 0, center, 256);
  vertical.addColorStop(0, 'rgba(255,240,190,0)');
  vertical.addColorStop(.42, 'rgba(255,240,190,.07)');
  vertical.addColorStop(.5, 'rgba(255,255,235,.28)');
  vertical.addColorStop(.58, 'rgba(255,240,190,.07)');
  vertical.addColorStop(1, 'rgba(255,240,190,0)');
  context.fillStyle = vertical;
  context.fillRect(center - 2, 0, 4, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const starFlare = starFlareTexture();

function createStarSurfaceMaterial(colorHex) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDir;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.1;
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        float mu = max(dot(vNormal, vViewDir), 0.0);
        float t = uTime * 0.035;
        float granule = fbm(vUv * vec2(45.0, 22.0) + vec2(t, -t * .72));
        float broadFlow = fbm(vUv * vec2(8.0, 4.0) - vec2(t * .35, t * .18));
        float convection = smoothstep(.28, .72, granule * .72 + broadFlow * .28);
        float limb = pow(mu, .28);
        vec3 hot = uColor * 1.52 + vec3(.18, .12, .03);
        vec3 whiteHot = mix(uColor, vec3(1.0, .92, .72), .3);
        vec3 cool = uColor * (.28 + convection * .16);
        vec3 surface = mix(cool, mix(hot, whiteHot * 1.25, .18), limb * (.62 + convection * .38));
        surface += whiteHot * pow(convection, 3.2) * .08;
        surface += whiteHot * pow(mu, 3.4) * .05;
        surface += uColor * pow(1.0 - mu, 2.6) * .2;
        gl_FragColor = vec4(surface, 1.0);
      }
    `,
    depthWrite: true,
    toneMapped: false,
  });
  starMaterials.add(material);
  return material;
}

function createStarGlowLayers(radius, colorHex, intensity = 1) {
  const group = new THREE.Group();
  const color = new THREE.Color(colorHex);
  const inner = new THREE.Sprite(new THREE.SpriteMaterial({
    map: starCorona,
    color,
    transparent: true,
    opacity: .42 * intensity,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  }));
  inner.name = 'starInnerGlow';
  inner.frustumCulled = false;
  inner.scale.set(radius * 3.7, radius * 3.7, 1);
  inner.renderOrder = 10;
  group.add(inner);

  const outer = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgb(255, 245, 218)', 'rgb(134, 116, 240)'),
    color: color.clone().lerp(new THREE.Color('#fff1d6'), .22),
    transparent: true,
    opacity: .18 * intensity,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  }));
  outer.name = 'starOuterGlow';
  outer.frustumCulled = false;
  outer.scale.set(radius * 8.8, radius * 8.8, 1);
  outer.renderOrder = 9;
  group.add(outer);

  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: starFlare,
    color: color.clone().lerp(new THREE.Color('#fff7df'), .42),
    transparent: true,
    opacity: .13 * intensity,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  }));
  flare.name = 'starFlare';
  flare.frustumCulled = false;
  flare.scale.set(radius * 10.2, radius * 10.2, 1);
  flare.renderOrder = 8;
  group.add(flare);
  return { group, inner, outer, flare };
}

const galaxyGroup = new THREE.Group();
// 导航分区、恒星、行星轨道和行星使用同一套静态世界坐标。
// 不能旋转这个父级：行星组位于场景根节点，旋转会让两套坐标逐渐错位。
galaxyGroup.renderOrder = -4;
scene.add(galaxyGroup);
const galaxyCanvas = document.createElement('canvas');
galaxyCanvas.width = 1200;
galaxyCanvas.height = 620;
const galaxyContext = galaxyCanvas.getContext('2d');
const galaxyCenterX = 600;
const galaxyCenterY = 310;

const skyBase = galaxyContext.createRadialGradient(galaxyCenterX, galaxyCenterY, 30, galaxyCenterX, galaxyCenterY, 760);
skyBase.addColorStop(0, 'rgba(6, 11, 30, .98)');
skyBase.addColorStop(.34, 'rgba(3, 8, 22, .99)');
skyBase.addColorStop(.72, 'rgba(1, 5, 16, 1)');
skyBase.addColorStop(1, 'rgba(1, 3, 10, 1)');
galaxyContext.fillStyle = skyBase;
galaxyContext.fillRect(0, 0, galaxyCanvas.width, galaxyCanvas.height);

function paintNebulaBand(y, rgb, opacity, rotation, height) {
  galaxyContext.save();
  galaxyContext.translate(galaxyCenterX, y);
  galaxyContext.rotate(rotation);
  galaxyContext.scale(1, .34);
  const band = galaxyContext.createRadialGradient(0, 0, 16, 0, 0, 540);
  band.addColorStop(0, `rgba(${rgb}, ${opacity})`);
  band.addColorStop(.3, `rgba(${rgb}, ${opacity * .62})`);
  band.addColorStop(.72, `rgba(${rgb}, .05)`);
  band.addColorStop(1, 'rgba(0, 0, 0, 0)');
  galaxyContext.fillStyle = band;
  galaxyContext.beginPath();
  galaxyContext.ellipse(0, 0, 565, height, 0, 0, Math.PI * 2);
  galaxyContext.fill();
  galaxyContext.restore();
}

paintNebulaBand(galaxyCenterY, '244, 193, 143', .03, -.14, 78);
paintNebulaBand(galaxyCenterY - 3, '174, 157, 242', .015, -.14, 58);
paintNebulaBand(galaxyCenterY + 8, '98, 143, 231', .008, -.14, 40);

galaxyContext.save();
galaxyContext.globalCompositeOperation = 'lighter';
for (let cloudIndex = 0; cloudIndex < 28; cloudIndex++) {
  const x = 120 + random() * 960;
  const y = galaxyCenterY + (random() - .5) * 100;
  const radius = 30 + random() * 56;
  const color = cloudIndex % 2 ? '104, 145, 240' : '232, 164, 201';
  const cloud = galaxyContext.createRadialGradient(x, y, 0, x, y, radius);
  cloud.addColorStop(0, `rgba(${color}, .04)`);
  cloud.addColorStop(1, `rgba(${color}, 0)`);
  galaxyContext.fillStyle = cloud;
  galaxyContext.beginPath();
  galaxyContext.ellipse(x, y, radius * 1.7, radius * .28, -.14, 0, Math.PI * 2);
  galaxyContext.fill();
}
galaxyContext.restore();

for (let i = 0; i < 1250; i++) {
  const angle = random() * Math.PI * 2;
  const radius = Math.pow(random(), .56) * 265;
  const x = galaxyCenterX + Math.cos(angle) * radius * 1.72;
  const y = galaxyCenterY + Math.sin(angle) * radius * .48 + (random() - .5) * (10 + radius * .06);
  const size = random() * 1.05 + .25;
  galaxyContext.fillStyle = random() > .52 ? 'rgba(206, 218, 255, .3)' : 'rgba(255, 214, 185, .24)';
  galaxyContext.beginPath();
  galaxyContext.arc(x, y, size, 0, Math.PI * 2);
  galaxyContext.fill();
}
const galaxyBackdrop = new THREE.Sprite(new THREE.SpriteMaterial({
  map: new THREE.CanvasTexture(galaxyCanvas), transparent: true, opacity: .96, blending: THREE.NormalBlending, depthTest: false, depthWrite: false,
}));
galaxyBackdrop.position.z = -42;
galaxyBackdrop.rotation.z = -.08;
galaxyBackdrop.scale.set(520, 268, 1);
galaxyBackdrop.renderOrder = -5;
galaxyBackdrop.visible = false;
scene.add(galaxyBackdrop);

// 总览背景固定在相机后方，避免世界坐标中的银河盘面因镜头拉远而变成几乎不可见的黑底。
const deepSkySprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: galaxyBackdrop.material.map,
  transparent: true,
  opacity: .36,
  blending: THREE.NormalBlending,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
}));
deepSkySprite.position.set(0, 0, -900);
deepSkySprite.scale.set(1800, 900, 1);
deepSkySprite.renderOrder = -100;
deepSkySprite.visible = false;
camera.add(deepSkySprite);
scene.add(camera);

const nebulaGroup = new THREE.Group();
nebulaGroup.position.z = -4;
nebulaGroup.rotation.z = -.12;
const nebulaLayers = [
  { inner: 'rgb(255, 221, 171)', outer: 'rgb(118, 101, 220)', scale: [148, 34], position: [0, 0, 0], opacity: .72 },
  { inner: 'rgb(130, 154, 255)', outer: 'rgb(52, 103, 218)', scale: [182, 21], position: [-12, 3, -.5], opacity: .46 },
  { inner: 'rgb(244, 157, 205)', outer: 'rgb(125, 82, 203)', scale: [154, 18], position: [18, -5, -.8], opacity: .37 },
  { inner: 'rgb(114, 204, 220)', outer: 'rgb(54, 95, 187)', scale: [120, 14], position: [-32, -8, -1], opacity: .3 },
  { inner: 'rgb(255, 190, 157)', outer: 'rgb(171, 91, 185)', scale: [102, 13], position: [38, 8, -1.2], opacity: .25 },
];
for (const layer of nebulaLayers) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(layer.inner, layer.outer),
    color: '#ffffff',
    transparent: true,
    opacity: layer.opacity,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.position.set(...layer.position);
  sprite.scale.set(...layer.scale, 1);
  nebulaGroup.add(sprite);
}
for (let i = 0; i < 12; i++) {
  const angle = -.45 + i * .24;
  const radius = 34 + (i % 4) * 13;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(i % 2 ? 'rgb(139, 150, 255)' : 'rgb(255, 175, 197)', 'rgb(52, 88, 180)'),
    color: '#ffffff',
    transparent: true,
    opacity: .11,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .32, -2 - i * .04);
  sprite.rotation.z = angle;
  sprite.scale.set(28 + (i % 3) * 10, 7 + (i % 2) * 3, 1);
  nebulaGroup.add(sprite);
}
galaxyGroup.add(nebulaGroup);
const galaxyPositions = [];
const galaxyColors = [];
for (let i = 0; i < 4800; i++) {
  const radius = Math.pow(random(), .62) * 86;
  const arm = Math.floor(random() * 5);
  const angle = arm * Math.PI * 2 / 5 + radius * .075 + (random() - .5) * (.25 + radius * .012);
  const spread = (random() - .5) * (2.4 + radius * .045);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * .46 + spread;
  const z = (random() - .5) * (1.8 + radius * .035);
  galaxyPositions.push(x, y, z);
  const core = Math.max(0, 1 - radius / 90);
  galaxyColors.push(.34 + core * .5, .43 + core * .35, .65 + core * .28);
}
const galaxyGeometry = new THREE.BufferGeometry();
galaxyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(galaxyPositions, 3));
galaxyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(galaxyColors, 3));
const galaxyDustMaterial = new THREE.PointsMaterial({
  map: pointTexture,
  size: .5,
  vertexColors: true,
  transparent: true,
  alphaTest: .01,
  opacity: .45,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
galaxyGroup.add(new THREE.Points(galaxyGeometry, galaxyDustMaterial));

const galaxyCore = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture('rgb(240, 198, 145)', 'rgb(96, 122, 224)'),
  color: '#b99bff', transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
}));
galaxyCore.scale.set(76, 42, 1);
galaxyCore.material.opacity = .9;
// 旧版规则五臂点云会形成明显的图标状螺旋，交给体积 shader 生成自然尘埃结构。
galaxyDustMaterial.opacity = 0;
galaxyCore.visible = false;
galaxyGroup.add(galaxyCore);

const orbitGroup = new THREE.Group();
orbitGroup.rotation.set(.24, -.23, .04);
scene.add(orbitGroup);
const orbitBands = [
  { radius: 24, squash: .72, color: '#6eaaa6', opacity: .17, label: '核心舞台 · 同星球' },
  { radius: 52, squash: .68, color: '#d8b86f', opacity: .14, label: '圣都 · 跨界守护者的居所' },
  { radius: 88, squash: .62, color: '#c19a83', opacity: .1, label: '对齐航路 · 旧塔短时对接' },
  { radius: 122, squash: .56, color: '#877ba4', opacity: .07, label: '远程外圈 · 独立世界' },
];
for (const band of orbitBands) {
  const points = [];
  for (let i = 0; i <= 192; i++) {
    const angle = i / 192 * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * band.radius, Math.sin(angle) * band.radius * band.squash, 0));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: band.color, transparent: true, opacity: band.opacity * .72, dashSize: 1.5, gapSize: 2.3, depthWrite: false }));
  line.computeLineDistances();
  line.userData.orbitLabel = band.label;
  orbitGroup.add(line);
  const ticks = [];
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * Math.PI * 2;
    ticks.push(Math.cos(angle) * band.radius, Math.sin(angle) * band.radius * band.squash, .12);
  }
  const tickGeometry = new THREE.BufferGeometry();
  tickGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
  orbitGroup.add(new THREE.Points(tickGeometry, new THREE.PointsMaterial({ map: pointTexture, color: band.color, size: .3, transparent: true, alphaTest: .01, opacity: band.opacity * 1.1, depthWrite: false })));
}

const coreStar = new THREE.Mesh(
  new THREE.SphereGeometry(2.15, 32, 24),
  new THREE.MeshBasicMaterial({ color: '#f3c98c', transparent: true, opacity: .52, toneMapped: false }),
);
coreStar.position.set(0, 0, 0);
coreStar.visible = false;
orbitGroup.add(coreStar);
const coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture('rgb(255, 229, 165)', 'rgb(108, 104, 227)'), color: '#b793f0', transparent: true, opacity: .52, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
}));
coreHalo.scale.set(26, 26, 1);
orbitGroup.add(coreHalo);

const meshes = new Map();
const worldGroups = new Map();
const spinGroups = new Map();
const loader = new THREE.TextureLoader();

function registerWorldMaterial(material) {
  material.userData.baseOpacity = material.opacity;
  material.userData.baseTransparent = material.transparent;
  return material;
}

function createSkywayArc(radius, startAngle, endAngle, tilt, color, opacity) {
  const points = [];
  const segments = 28;
  for (let i = 0; i <= segments; i++) {
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, i / segments);
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0,
    ));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = registerWorldMaterial(new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  }));
  const arc = new THREE.Line(geometry, material);
  arc.rotation.set(tilt.x, tilt.y, tilt.z);
  arc.renderOrder = 2;
  return arc;
}

function createSkyCityHub(group, bodyRadius) {
  const city = new THREE.Group();
  city.name = 'skyCityDomain';

  const coreMaterial = registerWorldMaterial(new THREE.MeshStandardMaterial({
    color: '#f5d895',
    emissive: '#b88442',
    emissiveIntensity: .95,
    roughness: .38,
    metalness: .18,
  }));
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(bodyRadius * .16, 32, 20),
    coreMaterial,
  );
  core.scale.set(1, .78, 1);
  core.position.y = .03;
  city.add(core);

  const coreSpine = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius * .035, bodyRadius * .06, bodyRadius * .84, 12),
    registerWorldMaterial(new THREE.MeshBasicMaterial({
      color: '#f8e8a8',
      transparent: true,
      opacity: .86,
      toneMapped: false,
    })),
  );
  coreSpine.position.y = -.04;
  city.add(coreSpine);

  const deckMaterial = registerWorldMaterial(new THREE.MeshStandardMaterial({
    color: '#4f7892',
    emissive: '#1a5870',
    emissiveIntensity: .68,
    roughness: .55,
    metalness: .48,
  }));
  const goldDeckMaterial = registerWorldMaterial(new THREE.MeshStandardMaterial({
    color: '#e0bd73',
    emissive: '#855d24',
    emissiveIntensity: .65,
    roughness: .4,
    metalness: .42,
  }));
  const lowerDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius * .78, bodyRadius * .98, .24, 40),
    deckMaterial,
  );
  lowerDeck.position.y = -.5;
  city.add(lowerDeck);
  const upperDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius * .5, bodyRadius * .66, .2, 32),
    goldDeckMaterial,
  );
  upperDeck.position.y = .62;
  city.add(upperDeck);

  const deckEdgeMaterial = registerWorldMaterial(new THREE.MeshBasicMaterial({
    color: '#8de4dc',
    transparent: true,
    opacity: .78,
    toneMapped: false,
  }));
  for (const [radius, y, tube] of [
    [bodyRadius * .9, -.37, .045],
    [bodyRadius * .58, .74, .035],
  ]) {
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 64),
      deckEdgeMaterial,
    );
    edge.rotation.x = Math.PI / 2;
    edge.position.y = y;
    city.add(edge);
  }

  const towerMaterial = registerWorldMaterial(new THREE.MeshStandardMaterial({
    color: '#d9e6df',
    emissive: '#72c9c0',
    emissiveIntensity: .72,
    roughness: .36,
    metalness: .26,
  }));
  const towerCount = 13;
  for (let i = 0; i < towerCount; i++) {
    const angle = i / towerCount * TWO_PI + .18;
    const radius = bodyRadius * (.44 + (i % 3) * .11);
    const height = bodyRadius * (.28 + (i % 4) * .09);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(.09 + (i % 2) * .025, .14, height, 7),
      towerMaterial,
    );
    tower.position.set(Math.cos(angle) * radius, .72 + height * .5, Math.sin(angle) * radius);
    city.add(tower);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(.07 + (i % 2) * .02, 10, 8),
      registerWorldMaterial(new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? '#f5d895' : '#9be4d2',
        toneMapped: false,
      })),
    );
    beacon.position.set(Math.cos(angle) * radius,  .72 + height + .05, Math.sin(angle) * radius);
    city.add(beacon);
  }

  const veinMaterial = registerWorldMaterial(new THREE.MeshBasicMaterial({
    color: '#9be4d2',
    transparent: true,
    opacity: .8,
    depthWrite: false,
    toneMapped: false,
  }));
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * TWO_PI;
    const vein = new THREE.Mesh(
      new THREE.CylinderGeometry(.04, .065, bodyRadius * 1.35, 6),
      veinMaterial,
    );
    vein.position.set(Math.cos(angle) * bodyRadius * .3, .02, Math.sin(angle) * bodyRadius * .3);
    vein.rotation.z = Math.cos(angle) * .16;
    vein.rotation.x = Math.sin(angle) * .16;
    city.add(vein);
  }

  city.add(createSkywayArc(bodyRadius * .98, -.92, .7, new THREE.Vector3(.54, -.18, .28), '#f1ca77', .72));
  city.add(createSkywayArc(bodyRadius * 1.12, 1.72, 3.98, new THREE.Vector3(-.34, .46, -.12), '#7ed8d1', .55));
  city.add(createSkywayArc(bodyRadius * 1.28, 4.22, 5.35, new THREE.Vector3(.82, .18, .46), '#e5b96b', .38));

  const stationMaterial = registerWorldMaterial(new THREE.MeshBasicMaterial({
    color: '#fff0b9',
    transparent: true,
    opacity: .9,
    toneMapped: false,
  }));
  for (let i = 0; i < 4; i++) {
    const angle = i / 4 * TWO_PI + .38;
    const station = new THREE.Mesh(
      new THREE.BoxGeometry(.24, .08, .58),
      stationMaterial,
    );
    station.position.set(Math.cos(angle) * bodyRadius * .9, -.22, Math.sin(angle) * bodyRadius * .9);
    station.rotation.y = -angle;
    city.add(station);
  }

  city.add(new THREE.PointLight('#f5d895', 1.15, bodyRadius * 4.2, 2));
  group.add(city);
  return core;
}

function createSanctuaryPlanet(group, bodyRadius, world) {
  const texture = loader.load(`textures/original/${world.texture}?v=${world.textureVersion || '20260927-shendu4'}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(bodyRadius, 80, 56),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      roughness: 1,
      metalness: 0,
      emissive: '#9ba9ae',
      emissiveIntensity: .26,
    }),
  );
  surface.name = 'sanctuaryPlanetSurface';
  group.add(surface);

  return surface;
}

for (const world of worlds) {
  const group = new THREE.Group();
  group.position.set(...world.position);
  scene.add(group);
  worldGroups.set(world.id, group);
  const bodyRadius = world.kind === 'hub' ? world.radius : PLANET_RADIUS;

  let surface;
  if (world.kind === 'hub') {
    // 圣都保留航路中枢身份，但视觉上是完整生命星球：海洋、花园与航站设施共存。
    surface = createSanctuaryPlanet(group, bodyRadius, world);
  } else {
    const texture = loader.load(`textures/original/${world.texture}?v=${world.textureVersion || '20260927-eight-planets'}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    surface = new THREE.Mesh(
      new THREE.SphereGeometry(bodyRadius, 64, 48),
        new THREE.MeshStandardMaterial({
          map: texture,
          emissiveMap: texture,
          roughness: .88,
          metalness: 0,
          // 夜面沿贴图保留极弱的空间散射底光，主亮面仍由恒星点光源决定。
          emissive: '#77838d',
          emissiveIntensity: world.destroyed ? .25 : .14,
        }),
    );
  }
  surface.material.userData.baseOpacity = surface.material.opacity;
  surface.material.userData.baseTransparent = surface.material.transparent;
  surface.userData.worldId = world.id;
  const axialGroup = new THREE.Group();
  axialGroup.rotation.z = THREE.MathUtils.degToRad(world.axialTiltDeg);
  const spinGroup = new THREE.Group();
  spinGroup.add(surface);
  axialGroup.add(spinGroup);
  group.add(axialGroup);
  spinGroups.set(world.id, spinGroup);
  meshes.set(world.id, surface);

  if (world.kind !== 'hub') {
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(bodyRadius * 1.055, 48, 32),
      new THREE.MeshBasicMaterial({ color: world.color, transparent: true, opacity: world.destroyed ? .05 : .09, side: THREE.BackSide, depthWrite: false }),
    );
    atmosphere.material.userData.baseOpacity = atmosphere.material.opacity;
    atmosphere.material.userData.baseTransparent = atmosphere.material.transparent;
    group.add(atmosphere);
  }

  if (world.ring) {
    const ringSystem = new THREE.Group();
    ringSystem.name = 'planetRingSystem';
    ringSystem.rotation.x = world.id === 'saturn' || world.id === 'uranus' ? Math.PI / 2 : 1.18;
    if (world.id !== 'saturn' && world.id !== 'uranus') ringSystem.rotation.y = .2;

    const fantasyRingLayers = [
      {
        inner: bodyRadius * 1.16,
        outer: bodyRadius * 1.66,
        colorA: '#d681b4',
        colorB: '#8bd7e7',
        opacity: .16,
        seed: 1.7,
        additive: true,
        glow: 1.45,
      },
      {
        inner: bodyRadius * 1.275,
        outer: bodyRadius * 1.345,
        colorA: '#f6d4e8',
        colorB: '#b7edf0',
        opacity: .76,
        seed: 4.2,
        glow: 1.25,
      },
      {
        inner: bodyRadius * 1.405,
        outer: bodyRadius * 1.49,
        colorA: '#dba4ce',
        colorB: '#8fd6e5',
        opacity: .42,
        seed: 8.6,
        additive: true,
        glow: 1.1,
      },
      {
        inner: bodyRadius * 1.555,
        outer: bodyRadius * 1.585,
        colorA: '#fff1f6',
        colorB: '#b8e9f0',
        opacity: .3,
        seed: 12.4,
        additive: true,
        glow: 1.6,
      },
    ];
    const ringLayers = world.id === 'saturn' ? [
      { inner: bodyRadius * 1.16, outer: bodyRadius * 1.75, colorA: '#716657', colorB: '#d6bd91', opacity: .48, seed: 2.1, physical: true },
      { inner: bodyRadius * 1.83, outer: bodyRadius * 2.18, colorA: '#ae9470', colorB: '#eddbb4', opacity: .78, seed: 4.7, physical: true },
      { inner: bodyRadius * 2.27, outer: bodyRadius * 2.52, colorA: '#97846d', colorB: '#c6af8e', opacity: .32, seed: 8.2, physical: true },
    ] : world.id === 'uranus' ? [
      { inner: bodyRadius * 1.39, outer: bodyRadius * 1.44, colorA: '#526d73', colorB: '#a3bbc0', opacity: .44, seed: 3.3, physical: true },
      { inner: bodyRadius * 1.61, outer: bodyRadius * 1.65, colorA: '#456269', colorB: '#8faeb4', opacity: .3, seed: 6.1, physical: true },
    ] : fantasyRingLayers;
    for (const layer of ringLayers) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(layer.inner, layer.outer, 192, 6),
        createPlanetRingMaterial(layer),
      );
      ring.name = 'planetRingBand';
      ringSystem.add(ring);
    }
    if (world.id !== 'saturn' && world.id !== 'uranus') ringSystem.add(createPlanetRingParticles(bodyRadius));
    axialGroup.add(ringSystem);
  }

  if (world.destroyed) {
    const debrisGeometry = new THREE.IcosahedronGeometry(1, 0);
    const debrisMaterial = new THREE.MeshStandardMaterial({
      color: world.color,
      emissive: world.color,
      emissiveIntensity: .07,
      roughness: .84,
      metalness: .04,
      flatShading: true,
      transparent: true,
      opacity: .78,
    });
    debrisMaterial.userData.baseOpacity = debrisMaterial.opacity;
    debrisMaterial.userData.baseTransparent = debrisMaterial.transparent;
    const debris = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, 85);
    const debrisTransform = new THREE.Object3D();
    const debrisColor = new THREE.Color(world.color);
    for (let i = 0; i < 85; i++) {
      const angle = random() * Math.PI * 2;
      const radius = bodyRadius * (1.4 + random() * 1.0);
      debrisTransform.position.set(
        Math.cos(angle) * radius,
        (random() - .5) * bodyRadius * .85,
        Math.sin(angle) * radius,
      );
      debrisTransform.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      const size = bodyRadius * (.045 + random() * .09);
      debrisTransform.scale.set(size * (0.72 + random() * .55), size, size * (0.72 + random() * .55));
      debrisTransform.updateMatrix();
      debris.setMatrixAt(i, debrisTransform.matrix);
      debrisColor.set(world.color);
      debrisColor.offsetHSL((random() - .5) * .035, .04 + random() * .12, -.08 + random() * .16);
      debris.setColorAt(i, debrisColor);
    }
    debris.instanceMatrix.needsUpdate = true;
    if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
    group.add(debris);
  }
}

const focusStarGroup = new THREE.Group();
const focusStarGlow = createStarGlowLayers(STAR_RADIUS, '#ffbf87');
const focusStar = focusStarGlow.inner;
focusStarGroup.add(focusStarGlow.group);
const focusStarMaterial = createStarSurfaceMaterial('#ffbf87');
const focusStarCore = new THREE.Mesh(
  new THREE.SphereGeometry(STAR_RADIUS, 48, 48),
  focusStarMaterial,
);
focusStarGroup.add(focusStarCore);
focusStarGroup.visible = false;
scene.add(focusStarGroup);

function constrainFocusStarGlow() {
  if (!focusStarGroup.visible) return;
  const groupScale = Math.max(focusStarGroup.scale.x, .001);
  const cameraDistance = camera.position.distanceTo(focusStarGroup.position);
  // 辉光是视觉层，不应在镜头过近或转场途中盖住整个视口；恒星本体仍保持真实世界尺寸。
  const outerLimit = Math.max(STAR_RADIUS * .82, cameraDistance * .28 / groupScale);
  const outerSize = Math.min(STAR_RADIUS * 5.4, outerLimit);
  const innerSize = Math.min(STAR_RADIUS * 2.7, outerSize * .62);
  const flareSize = Math.min(STAR_RADIUS * 6.2, outerSize * 1.28);
  focusStarGlow.outer.scale.setScalar(outerSize);
  focusStarGlow.inner.scale.setScalar(innerSize);
  focusStarGlow.flare.scale.setScalar(flareSize);
}

const stellarMarkers = new THREE.Group();
const stellarMarkerData = [
  { position: [-52, 34, -34], scale: 4.1, inner: 'rgb(255, 243, 205)', outer: 'rgb(255, 132, 87)' },
  { position: [51, 31, -32], scale: 3.4, inner: 'rgb(202, 231, 255)', outer: 'rgb(82, 139, 255)' },
  { position: [-57, -30, 29], scale: 3.2, inner: 'rgb(255, 220, 178)', outer: 'rgb(226, 115, 192)' },
  { position: [48, -29, -24], scale: 3.8, inner: 'rgb(194, 247, 235)', outer: 'rgb(62, 167, 204)' },
  { position: [5, 35, -38], scale: 2.8, inner: 'rgb(255, 240, 202)', outer: 'rgb(188, 129, 242)' },
];
for (const marker of stellarMarkerData) {
  const star = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(marker.inner, marker.outer),
    color: '#ffffff', transparent: true, opacity: .72, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, toneMapped: false,
  }));
  star.position.set(...marker.position);
  star.scale.set(marker.scale, marker.scale, 1);
  stellarMarkers.add(star);
}
galaxyGroup.add(stellarMarkers);
stellarMarkers.visible = false;

const systemMapGroup = new THREE.Group();
const systemDefinitions = [
  // 恒星系位置使用三维光年坐标；局部行星公转仍使用各自的水平轨道面。
  { id: 'yanyao', name: '地球航路', starName: '太阳', subtitle: '太阳 · 太阳系中心恒星', description: '太阳系八大行星按当前星历公转；洛蒂尔的故乡露菲茵位于太阳系之外。', position: [-84, 0, -76], distanceLy: [0, 0, 0], color: '#ffbf87', light: '#ffe4b2', starRadius: STAR_RADIUS, massSolar: 1, orbits: [18, 27] },
  { id: 'luhui', name: '露光星域', starName: '露辉', subtitle: '柔白导航恒星 · 露米菈航路锚点', description: '露米菈是ARS02与ARS03的共同舞台，萤露小镇与糖霜城位于这颗星球。露辉的名称与坐标用于星图展示。', position: [0, 0, -40], distanceLy: [12.8, 4.2, 2.6], color: '#bba4ff', light: '#fff0cb', starRadius: STAR_RADIUS, massSolar: 1.08, orbits: [18, 29] },
  { id: 'lufeyin-system', name: '露菲茵星系', starName: '露茵', subtitle: '粉金恒星 · 露菲茵故乡星系', description: '露菲茵位于独立恒星系。洛蒂尔因故乡遭侵略逃往地球，之后收到来自故乡的信号；星图将该星系安排在地球近邻区域。', position: [24, 0, -18], distanceLy: [11.6, 2.8, -5.2], color: '#d8a3a1', light: '#ffe0d8', starRadius: STAR_RADIUS, massSolar: .86, orbits: [18] },
  { id: 'diya-system', name: '蒂娅星系', starName: '蒂蓝', subtitle: '蓝白恒星 · 蒂娅遗址航路', description: '蒂娅属于独立恒星系，故乡毁灭后缇娜携光剑逃到地球。星图将它安排在地球近邻区域，文档未交代具体航迹或交通工具。', position: [-30, 0, 26], distanceLy: [16.8, -3.6, 8.4], color: '#9ab8d8', light: '#e1efff', starRadius: STAR_RADIUS, massSolar: .9, orbits: [22] },
  { id: 'viskar-system', name: '曦源星系', starName: '曦源', subtitle: '冷白恒星 · 维斯卡尔与圣都航路', description: '曦源是曦源星系的主星；维斯卡尔星与圣都位于同一恒星系的不同轨道，双方的纷争因此具备近距离往来的条件。', position: [22, 0, -6], distanceLy: [8.6, 2.8, -0.6], color: '#91c9e8', light: '#e2f4ff', starRadius: STAR_RADIUS, massSolar: 1.04, orbits: [24] },
  { id: 'fudisi-system', name: '芙蒂丝星系', starName: '芙曜', subtitle: '暖红恒星 · 芙蒂丝独立舞台', description: '芙蒂丝是ARS04的主舞台，双子姐妹在这里出生、入学并接受委托。它与圣都分属不同恒星系；现有文档未设定两者间的固定中继航路。', position: [84, 0, -76], distanceLy: [42.4, -15.2, -20.8], color: '#e89673', light: '#ffe0b2', starRadius: STAR_RADIUS, massSolar: 1.12, orbits: [24, 38, 54] },
  { id: 'baixi-system', name: '赛拉菲斯星系', starName: '赛辉', subtitle: '淡金恒星 · 赛拉菲斯故乡航路', description: '赛拉菲斯与芙蒂丝属于不同恒星系。伊德拉企图通过伊德拉之门将故乡的高热与陨石灾害转移到地球，妮贝琪与伙伴为此展开旅行。', position: [116, 0, -42], distanceLy: [46.8, -12.4, -17.6], color: '#c9d99f', light: '#fff0c8', starRadius: STAR_RADIUS, massSolar: .94, orbits: [26] },
  { id: 'yaoxian-system', name: '迦罗厄星系', starName: '迦穹', subtitle: '冷紫恒星 · 迦罗厄来源航路', description: '迦穹是迦罗厄星系的主星；迦罗厄与芙蒂丝、赛拉菲斯均为独立恒星系，ARS09的来源线通过远程航路与地球相连。', position: [52, 0, -112], distanceLy: [37.8, -18.8, -28.4], color: '#b5a4cc', light: '#ead7ef', starRadius: STAR_RADIUS, massSolar: .82, orbits: [31] },
  { id: 'xianxi', name: '古道星域', starName: '弦曦', subtitle: '粉金导航恒星 · 远行舞台分区锚点', description: '保留为远行主题的导航分区；分区名称只服务星图展示，不代表某一部 ARS 的独立主舞台或已确认恒星系。', position: [84, 0, 76], distanceLy: [61.2, 17.4, 25], color: '#f1a8ca', light: '#ffe0b4', starRadius: STAR_RADIUS, massSolar: .97, orbits: [24, 40] },
  { id: 'tilanno', name: '缇兰诺星系', starName: '翡曜', subtitle: '深绿导航恒星 · 缇兰诺星系航路锚点', description: '翡曜是缇兰诺星系的导航恒星；旧观测塔与星辰遗迹属于本星系内部的文明遗产，不与蒂娅星残骸共用恒星。', position: [-84, 0, 76], distanceLy: [31.6, -9.6, -12.2], color: '#9bc5ab', light: '#e8f4df', starRadius: STAR_RADIUS, massSolar: .88, orbits: [22, 34] },
  { id: 'lailer-system', name: '莱勒星系', starName: '晦曜', subtitle: '冷紫恒星 · 莱勒星所在星系', description: '莱勒星位于这一遥远恒星系；星图未据个别侵略者的行为推定整颗星球的政治结构。', position: [420, 0, -220], distanceLy: [610, -80, 175], color: '#b8a0cf', light: '#ead7ef', starRadius: STAR_RADIUS, massSolar: .81, orbits: [27] },
  { id: 'nokdun-system', name: '诺克顿星系', starName: '雾环', subtitle: '蓝白恒星 · 诺克顿星所在星系', description: '诺克顿星所在的远距恒星系，已知资料仅能确认族源关联与恒星位置。', position: [-520, 0, 270], distanceLy: [-820, 130, -220], color: '#a1bfdd', light: '#e1e9f2', starRadius: STAR_RADIUS, massSolar: 1.06, orbits: [34] },
  { id: 'kachi-system', name: '卡奇星系', starName: '赤衡', subtitle: '暖白恒星 · 卡奇星所在星系', description: '卡奇星人的原籍航路锚点；卡奇星的地貌、社会与当地居民情况仍缺少可靠资料。', position: [1330, 0, -550], distanceLy: [1330, -170, -550], color: '#d2a091', light: '#fff0d9', starRadius: STAR_RADIUS, massSolar: 1.18, orbits: [32] },
  { id: 'dumoen-system', name: '杜莫恩星系', starName: '黛穹', subtitle: '青白恒星 · 杜莫恩星所在星系', description: '杜莫恩星人的原籍航路锚点；一名流窜者自称的头衔不代表整颗星球的制度。', position: [-1420, 0, 980], distanceLy: [-1420, 200, 980], color: '#a5ccc0', light: '#e5f3e4', starRadius: STAR_RADIUS, massSolar: .92, orbits: [38] },
  { id: 'jingyuan-system', name: '静渊星系', starName: '静渊', subtitle: '白色恒星 · 无人行星群中心', description: '静渊星系保留岩质、冰质与气态三类无人天体，作为星图的深空地质观测区。', position: [190, 0, 560], distanceLy: [280, 100, 990], color: '#e8ddd0', light: '#f4e9db', starRadius: STAR_RADIUS, massSolar: 1.02, orbits: [10, 70, 145] },
  { id: 'noktia-system', name: '诺克提亚星系', starName: '暗曜', subtitle: '深紫恒星 · 诺克提亚星所在星系', description: '诺克提亚星所在的远距恒星系；已知资料仅能确认它与伊瑟拉的族源关联和恒星位置。', position: [330, 0, 285], distanceLy: [540, 150, 320], color: '#8b7fb5', light: '#e4dcf5', starRadius: STAR_RADIUS, massSolar: .88, orbits: [26] },
  { id: 'mirfa-system', name: '米尔珐星系', starName: '蚀曜', subtitle: '暗红恒星 · 米尔珐遗址航路', description: '米尔珐星系曾是绯陌故乡的所在；巨兽伽诺姆途经吞噬后，星图仅余破碎行星的航路锚点。', position: [-150, 0, -95], distanceLy: [-260, 60, -170], color: '#c98f9f', light: '#f5dfe6', starRadius: STAR_RADIUS, massSolar: .78, orbits: [20] },
  { id: 'lusete-system', name: '璐赛特星系', starName: '璐曦', subtitle: '淡紫恒星 · 璐赛特星所在星系', description: '璐赛特星所在的远距恒星系；已知资料仅能确认它与梦璃娅的族源关联和恒星位置。', position: [230, 0, -175], distanceLy: [380, -95, -240], color: '#c0a8d8', light: '#efe2ff', starRadius: STAR_RADIUS, massSolar: .9, orbits: [24] },
];
const starById = new Map(systemDefinitions.map((system) => [system.id, system]));
const starPickTargets = [];
const starLights = new Map();

function systemLightDistance(system) {
  const maximumOrbit = worlds
    .filter((world) => world.system === system.name)
    .reduce((maximum, world) => {
      const orbitRadius = world.orbitRadiusAU
        ? world.orbitRadiusAU * DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE
        : 0;
      return Math.max(maximum, orbitRadius);
    }, 80);
  // 留出行星大气层和聚焦镜头的余量，但小于相邻恒星的最短展示距离。
  return maximumOrbit + 88;
}

for (const system of systemDefinitions) {
  const systemGroup = new THREE.Group();
  systemGroup.position.set(...system.position);
  systemGroup.userData.starId = system.id;
  systemGroup.rotation.set(.2 + random() * .18, -.22 + random() * .2, .05);
  // 总览需要保留恒星的识别度；只放大视觉模型，不改变导航坐标。
  const mapStarRadius = system.starRadius;
  const starGlow = createStarGlowLayers(mapStarRadius, system.light, 1.35);
  systemGroup.add(starGlow.group);
  const starCore = new THREE.Mesh(
    new THREE.SphereGeometry(mapStarRadius, 48, 48),
    createStarSurfaceMaterial(system.color),
  );
  starCore.frustumCulled = false;
  systemGroup.renderOrder = 2;
  starCore.userData.starId = system.id;
  systemGroup.userData.starCore = starCore;
  starPickTargets.push(starCore);
  systemGroup.add(starCore);
  const distantLight = new THREE.Sprite(new THREE.SpriteMaterial({
    map: pointTexture, color: system.light, transparent: true, opacity: .82,
    blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false,
    toneMapped: false,
  }));
  distantLight.visible = false;
  systemGroup.userData.distantLight = distantLight;
  systemGroup.add(distantLight);
  // Star 宇宙用点光源照亮球面；这里跨星系场景必须恢复平方反比衰减，
  // 否则低衰减光源会穿越整张星图，把所有行星的昼夜面一起照亮。
  const oneAuRadius = DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE;
  const starLight = new THREE.PointLight(system.light, 2.2 * oneAuRadius ** 2, 0, 2);
  starLight.castShadow = false;
  starLight.position.set(...system.position);
  starLight.userData.starId = system.id;
  starLights.set(system.id, starLight);
  scene.add(starLight);
  systemMapGroup.add(systemGroup);
}
galaxyGroup.add(systemMapGroup);
const systemByName = new Map(systemDefinitions.map((system) => [system.name, system]));
// 原创星系的展示轨道采用水平 XZ 基准面；太阳系轨道另由星历保留真实倾角。
const systemOrbitNormals = new Map([
  ['yanyao', new THREE.Vector3(0, 1, 0)],
  ['luhui', new THREE.Vector3(0, 1, 0)],
  ['lufeyin-system', new THREE.Vector3(0, 1, 0)],
  ['diya-system', new THREE.Vector3(0, 1, 0)],
  ['viskar-system', new THREE.Vector3(0, 1, 0)],
  ['xianxi', new THREE.Vector3(0, 1, 0)],
  ['tilanno', new THREE.Vector3(0, 1, 0)],
]);

function sourcePosition(position) {
  return new THREE.Vector3(...position);
}

function solveKepler(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 8; i++) {
    eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(eccentricAnomaly);
  }
  return eccentricAnomaly;
}

function trueAnomalyFromEccentricAnomaly(eccentricAnomaly, eccentricity) {
  return 2 * Math.atan2(
    Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
  );
}

function orbitRadiusAtTrueAnomaly(state, trueAnomaly) {
  return state.semiMajorAxis * (1 - state.eccentricity ** 2)
    / (1 + state.eccentricity * Math.cos(trueAnomaly));
}

function solarPositionAU(body, timeMs) {
  const equatorial = Astronomy.HelioVector(body, new Date(timeMs));
  const cosTilt = Math.cos(J2000_OBLIQUITY);
  const sinTilt = Math.sin(J2000_OBLIQUITY);
  return new THREE.Vector3(
    equatorial.x,
    -equatorial.y * sinTilt + equatorial.z * cosTilt,
    equatorial.y * cosTilt + equatorial.z * sinTilt,
  );
}

function orbitPositionAtDays(state, simulatedDays) {
  if (state.solarBody) {
    return state.center.clone().add(solarPositionAU(state.solarBody, J2000_MS + simulatedDays * DAY_MS)
      .multiplyScalar(DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE));
  }
  const meanAnomaly = (state.meanAnomalyJ2000 + (simulatedDays / state.periodDays) * TWO_PI) % TWO_PI;
  const eccentricAnomaly = solveKepler(meanAnomaly, state.eccentricity);
  const trueAnomaly = trueAnomalyFromEccentricAnomaly(eccentricAnomaly, state.eccentricity);
  const radius = orbitRadiusAtTrueAnomaly(state, trueAnomaly);
  return state.center.clone()
    .addScaledVector(state.radialDirection, Math.cos(trueAnomaly) * radius)
    .addScaledVector(state.tangent, Math.sin(trueAnomaly) * radius);
}

function sceneSystemPosition(system) {
  return sourcePosition(system.distanceLy).multiplyScalar(GALAXY_SYSTEM_SCALE);
}

function systemOrbitNormal(system) {
  return systemOrbitNormals.get(system.id)?.clone() ?? new THREE.Vector3(0, 1, 0);
}

function sceneWorldPosition(world) {
  const system = systemByName.get(world.system);
  // 圣都保留跨宇宙中枢身份；只有没有物理恒星系的旧兼容数据才使用固定坐标。
  if (world.kind === 'hub' && world.system === '跨宇宙中枢') return new THREE.Vector3(5.2, 1.8, -1.4).multiplyScalar(GALAXY_SYSTEM_SCALE);
  if (!system) return sourcePosition(world.position).multiplyScalar(GALAXY_SYSTEM_SCALE);
  const local = sourcePosition(world.position).sub(sourcePosition(system.position));
  const normal = systemOrbitNormal(system);
  const projected = local.sub(normal.clone().multiplyScalar(local.dot(normal)));
  if (projected.lengthSq() < .001) projected.set(1, 0, 0);
  const radialDirection = projected.normalize();
  if (world.orbitPerihelionDeg !== undefined) {
    const perihelion = THREE.MathUtils.degToRad(world.orbitPerihelionDeg);
    radialDirection.set(Math.cos(perihelion), 0, Math.sin(perihelion));
  }
  const tangent = new THREE.Vector3().crossVectors(normal, radialDirection).normalize();
  if (world.orbitPerihelionDeg !== undefined) tangent.negate();
  const radius = world.orbitRadiusAU
    ? world.orbitRadiusAU * DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE
    : local.length() * LOCAL_SYSTEM_SCALE;
  const phase = world.orbitPhase ?? 0;
  const phasedDirection = radialDirection.multiplyScalar(Math.cos(phase)).add(tangent.multiplyScalar(Math.sin(phase)));
  return sceneSystemPosition(system).add(phasedDirection.multiplyScalar(radius));
}

for (const system of systemDefinitions) {
  const scenePosition = sceneSystemPosition(system);
  const systemGroup = systemMapGroup.children.find((group) => group.userData.starId === system.id);
  if (systemGroup) systemGroup.position.copy(scenePosition);
  const starLight = starLights.get(system.id);
  if (starLight) starLight.position.copy(scenePosition);
}

for (const world of worlds) {
  worldGroups.get(world.id)?.position.copy(sceneWorldPosition(world));
}

// 圣都已和维斯卡尔共用曦源的恒星光照；固定主光只保留为零强度的兼容对象。
const sanctuaryLightPosition = new THREE.Vector3(250, 170, 320);
const sanctuaryPrimaryLight = new THREE.PointLight('#fff1d2', 0, 0, 2);
sanctuaryPrimaryLight.name = 'sanctuaryPrimaryStarlight';
sanctuaryPrimaryLight.position.copy(sceneWorldPosition(worldById.get('shendu'))).add(sanctuaryLightPosition);
scene.add(sanctuaryPrimaryLight);
const focusPlanetLight = new THREE.PointLight('#ffffff', 0, 70, 2);
focusPlanetLight.name = 'focusStarExposureCompensation';
scene.add(focusPlanetLight);

const systemPositions = new Map(systemDefinitions.map((system) => [system.name, sceneSystemPosition(system)]));

const systemOrbitMapGroup = new THREE.Group();
const planetOrbitStates = new Map();
for (const system of systemDefinitions) {
  const orbitCluster = new THREE.Group();
  orbitCluster.position.copy(sceneSystemPosition(system));
  orbitCluster.userData.systemId = system.id;
  const orbitNormal = systemOrbitNormal(system);
  const members = worlds.filter((world) => world.system === system.name);
  for (const world of members) {
    const radial = sceneWorldPosition(world).sub(sceneSystemPosition(system));
    const radius = radial.length();
    if (radius < .1) continue;
    const radialDirection = radial.clone().normalize();
    const tangent = new THREE.Vector3().crossVectors(orbitNormal, radialDirection);
    if (tangent.lengthSq() < .001) tangent.set(1, 0, 0).cross(radialDirection);
    tangent.normalize();
    if (world.orbitPerihelionDeg !== undefined) tangent.negate();
    const eccentricity = world.orbitEccentricity
      ?? (.02 + .04 * Math.abs(Math.sin((world.orbitPhase ?? 0) * 1.7)));
    const semiMajorAxis = radius;
    const state = {
      group: worldGroups.get(world.id),
      center: sceneSystemPosition(system),
      radialDirection,
      tangent,
      radius,
      eccentricity,
      semiMajorAxis,
      solarBody: SOLAR_BODIES[world.id] ?? null,
      semiMajorAU: semiMajorAxis / (DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE),
      meanAnomalyJ2000: world.orbitMeanAnomalyJ2000Deg === undefined
        ? (world.orbitPhase ?? 0)
        : THREE.MathUtils.degToRad(world.orbitMeanAnomalyJ2000Deg),
      // 原创星系以各自恒星质量应用开普勒第三定律；太阳系的位置由星历求解。
      periodDays: world.orbitPeriodDays
        ?? 365.256 * Math.sqrt(Math.pow(semiMajorAxis / (DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE), 3) / system.massSolar),
    };
    planetOrbitStates.set(world.id, state);
    const points = [];
    const segments = semiMajorAxis > 1500 ? 384 : semiMajorAxis > 150 ? 192 : 160;
    const sampleStartDays = (Date.now() - J2000_MS) / DAY_MS;
    for (let i = 0; i < segments; i++) {
      if (state.solarBody) {
        points.push(orbitPositionAtDays(state, sampleStartDays + i / segments * state.periodDays)
          .sub(state.center));
        continue;
      }
      const meanAnomaly = i / segments * TWO_PI;
      const eccentricAnomaly = solveKepler(meanAnomaly, eccentricity);
      const trueAnomaly = trueAnomalyFromEccentricAnomaly(eccentricAnomaly, eccentricity);
      const orbitRadius = orbitRadiusAtTrueAnomaly(state, trueAnomaly);
      points.push(new THREE.Vector3(
        radialDirection.x * Math.cos(trueAnomaly) * orbitRadius + tangent.x * Math.sin(trueAnomaly) * orbitRadius,
        radialDirection.y * Math.cos(trueAnomaly) * orbitRadius + tangent.y * Math.sin(trueAnomaly) * orbitRadius,
        radialDirection.z * Math.cos(trueAnomaly) * orbitRadius + tangent.z * Math.sin(trueAnomaly) * orbitRadius,
      ));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: system.color,
      transparent: true,
      opacity: world.destroyed ? .09 : .18,
      dashSize: 1.8,
      gapSize: 2.8,
      depthWrite: false,
    });
    material.userData.baseOpacity = material.opacity;
    material.userData.focusOpacity = world.destroyed ? .16 : .34;
    material.userData.overviewOpacity = world.destroyed ? .14 : .34;
    const orbit = new THREE.LineLoop(geometry, material);
    orbit.computeLineDistances();
    orbit.renderOrder = -1;
    orbit.userData.worldId = world.id;
    orbit.userData.radius = semiMajorAxis * (1 + eccentricity);
    orbitCluster.add(orbit);
  }
  systemOrbitMapGroup.add(orbitCluster);
}
galaxyGroup.add(systemOrbitMapGroup);

function updatePlanetOrbits(currentTimeMs) {
  if (currentTimeMs - lastOrbitUpdateMs < 1000) return;
  lastOrbitUpdateMs = currentTimeMs;
  const elapsedDays = (currentTimeMs - J2000_MS) / DAY_MS;
  for (const state of planetOrbitStates.values()) {
    state.group.position.copy(orbitPositionAtDays(state, elapsedDays));
  }
}

let lastOrbitUpdateMs = -Infinity;

function rotationAngleAtTime(world, currentTimeMs) {
  const hoursSinceJ2000 = (currentTimeMs - J2000_MS) / (DAY_MS / 24);
  const turns = (hoursSinceJ2000 / Math.abs(world.rotationHours)) % 1;
  const axisInverted = world.axialTiltDeg > 90 ? -1 : 1;
  const direction = Math.sign(world.rotationHours) * axisInverted;
  return turns * TWO_PI * direction;
}

function updateWorldSpins(currentTimeMs) {
  for (const world of worlds) {
    spinGroups.get(world.id).rotation.y = rotationAngleAtTime(world, currentTimeMs);
  }
}

function physicalWorldPosition(world) {
  const state = planetOrbitStates.get(world.id);
  return state
    ? orbitPositionAtDays(state, (Date.now() - J2000_MS) / DAY_MS)
    : sceneWorldPosition(world);
}

function updateFocusPlanetLight() {
  if (!selected || selectedStar) {
    focusPlanetLight.intensity = 0;
    return;
  }
  const system = systemByName.get(selected.system);
  const starPosition = system && systemPositions.get(system.name);
  const planetPosition = worldGroups.get(selected.id)?.position;
  const starLight = system && starLights.get(system.id);
  if (!starPosition || !planetPosition || !starLight) {
    if (selected.destroyed && planetPosition) {
      focusPlanetLight.position.copy(planetPosition).add(new THREE.Vector3(22, 26, 18));
      focusPlanetLight.color.set('#edc5b5');
      focusPlanetLight.intensity = 1.8 * 30 ** 2;
    } else {
      focusPlanetLight.intensity = 0;
    }
    return;
  }
  const distanceSq = planetPosition.distanceToSquared(starPosition);
  const starFlux = starLight.intensity / Math.max(distanceSq, 1);
  const towardStar = starPosition.clone().sub(planetPosition).normalize();
  focusPlanetLight.position.copy(planetPosition).addScaledVector(towardStar, 30);
  focusPlanetLight.color.copy(starLight.color);
  focusPlanetLight.intensity = Math.max(0, 2.8 - starFlux) * 30 ** 2;
}

const distanceAnchorBySystem = new Map([
  ...systemDefinitions.map((system) => [system.name, new THREE.Vector3(...system.distanceLy)]),
  // 圣都已纳入曦源星系；“跨宇宙中枢”只保留为功能身份，不再作为物理恒星系。
]);

// 星域分组只用于星图展示，不代表同一物理恒星系。
// 距离计算为每个世界提供独立的“星际演示坐标”，避免把不同世界误算成几 AU。
// 这些坐标是原创星图的演示坐标，用于比较世界之间的尺度，不冒充现实天文测量。
const distanceAnchorByWorld = new Map([
  ['cangyan', new THREE.Vector3(0, 0, 0)],
  ['shendu', new THREE.Vector3(8.6, 2.8, -0.6)],
  ['lufeyin', new THREE.Vector3(11.6, 2.8, -5.2)],
  ['lumila', new THREE.Vector3(12.8, 4.2, 2.6)],
  ['tilanno', new THREE.Vector3(31.6, -9.6, -12.2)],
  ['fudisi', new THREE.Vector3(42.4, -15.2, -20.8)],
  ['diya', new THREE.Vector3(16.8, -3.6, 8.4)],
  ['baixi', new THREE.Vector3(61.2, 17.4, 25)],
  ['yaoxian', new THREE.Vector3(72.8, 26.6, 32.2)],
  ['viskar', new THREE.Vector3(8.6, 2.8, -0.6)],
  ['lailer', new THREE.Vector3(610, -80, 175)],
  ['nokdun', new THREE.Vector3(-820, 130, -220)],
  ['kachi', new THREE.Vector3(1330, -170, -550)],
  ['dumoen', new THREE.Vector3(-1420, 200, 980)],
  ['lijin', new THREE.Vector3(280, 100, 990)],
  ['shuanghui', new THREE.Vector3(280, 100, 990)],
  ['qingmu', new THREE.Vector3(280, 100, 990)],
  ['noktia', new THREE.Vector3(540, 150, 320)],
  ['mirfa', new THREE.Vector3(-260, 60, -170)],
  ['lusete', new THREE.Vector3(380, -95, -240)],
]);

function distanceVectorAtCurrentEpoch(world, currentTimeMs = Date.now()) {
  const solarBody = SOLAR_BODIES[world.id];
  if (solarBody) return solarPositionAU(solarBody, currentTimeMs).multiplyScalar(AU_TO_LIGHT_YEAR);
  const anchor = distanceAnchorByWorld.get(world.id)
    ?? distanceAnchorBySystem.get(world.system)
    ?? new THREE.Vector3();
  const result = anchor.clone();
  const state = planetOrbitStates.get(world.id);
  const system = systemByName.get(world.system);
  if (!state || !system) return result;

  const localScenePosition = orbitPositionAtDays(state, (currentTimeMs - J2000_MS) / DAY_MS)
    .sub(sceneSystemPosition(system));
  const localAu = localScenePosition.multiplyScalar(1 / (DISPLAY_UNITS_PER_AU * LOCAL_SYSTEM_SCALE));
  result.add(localAu.multiplyScalar(AU_TO_LIGHT_YEAR));
  return result;
}

function formatLightDuration(distanceLy) {
  const seconds = distanceLy * 365.25 * DAY_MS / 1000;
  if (seconds < 1) return `${seconds.toFixed(2)} 秒`;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} 分钟`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} 小时`;
  if (seconds < 365.25 * 86400) return `${(seconds / 86400).toFixed(1)} 天`;
  return `${(seconds / (365.25 * 86400)).toFixed(2)} 年`;
}

function formatDistanceKilometers(distanceKm) {
  if (distanceKm >= 1e8) return `${(distanceKm / 1e8).toFixed(2)} 亿公里`;
  if (distanceKm >= 1e4) return `${Math.round(distanceKm / 1e4).toLocaleString('zh-CN')} 万公里`;
  return `${Math.round(distanceKm).toLocaleString('zh-CN')} 公里`;
}

function formatFastestCraftDuration(distanceLy) {
  const years = distanceLy * FASTEST_CRAFT_YEARS_PER_LIGHT_YEAR;
  if (years < 1 / 365.25) return `${(years * 365.25 * 24).toFixed(1)} 小时以上`;
  if (years < 1) return `${(years * 365.25).toFixed(1)} 天以上`;
  if (years < 100) return `${years.toFixed(1)} 年以上`;
  return `${Math.round(years).toLocaleString()} 年以上`;
}

const pairKey = (first, second) => [first.id, second.id].sort().join('|');

// 每组说明都对应现有世界关系。星域分组只是导航展示，不能自动推导为同一恒星系；
// 每组关系都直接给出独立判断，不把星图分组当作现实航线。
const pairTechAssessments = canonPairAssessments;

function getRealTechAssessment(first, second) {
  const start = endpointNotes[first.id];
  const destination = endpointNotes[second.id];
  if (SOLAR_BODIES[first.id] && SOLAR_BODIES[second.id]) {
    const note = solarPairNotes[pairKey(first, second)];
    const fromEarth = first.id === 'cangyan';
    const targetRecord = {
      mercury: '信使号曾绕水星运行', venus: '金星曾有短时无人着陆', mars: '火星已有巡视器',
      jupiter: '朱诺号已绕木星运行', saturn: '卡西尼号已绕土星运行',
      uranus: '天王星仅有旅行者 2 号飞掠', neptune: '海王星仅有旅行者 2 号飞掠',
    };
    return {
      tone: fromEarth ? 'possible' : 'special',
      title: `${first.name} → ${second.name}：${fromEarth ? targetRecord[second.id] : '目前没有从起点直接发射的任务'}`,
      detail: `${note} 从${first.name}出发，${start.departure}；到达${second.name}时，${destination.arrival}。图中数字是此刻两颗行星的空间直线距离，真实飞行必须另算转移轨道、发射窗口与制动。`,
      crewed: fromEarth
        ? `无人探测：${targetRecord[second.id]}。载人：尚无该目的地的成熟往返任务。`
        : `无人探测：${first.name}目前没有现实中的发射设施；可计算轨道，不代表已经具备从那里起飞的能力。载人：不可行。`,
    };
  }
  const assessment = pairTechAssessments.get(pairKey(first, second));
  if (assessment) {
    return {
      ...assessment,
      detail: `${assessment.detail} 从${first.name}出发，${start.departure}；抵达${second.name}，${destination.arrival}。`,
    };
  }
  if (first.system === second.system && [
    '露光星域', '缇兰诺星系', '莱勒星系', '诺克顿星系',
    '卡奇星系', '杜莫恩星系', '静渊星系',
  ].includes(first.system)) {
    return {
      tone: 'special',
      title: `${first.name} → ${second.name}：${first.system}内的轨道任务`,
      detail: `${first.name}与${second.name}在企划中共用${first.system}的恒星。${start.departure}；${destination.arrival}。两者当前的演示直线间距可作任务尺度参考，飞行时间仍需该恒星质量和轨道实测。`,
      crewed: '无人探测：若探测器已在该星系，可先测定轨道再规划转移；地球目前没有跨星际送达它的能力。载人：不可行。',
    };
  }
  const isSolarMixed = !!(SOLAR_BODIES[first.id] || SOLAR_BODIES[second.id]);
  const relationship = first.links?.includes(second.id) || second.links?.includes(first.id)
    ? '星图为两地提供关联浏览入口，具体往来须以作品记录为准，不能据此推定固定交通航线。'
    : first.destroyed || second.destroyed
      ? '其中一端是破碎遗址，抵达后还必须先确定碎片轨道与安全接近距离。'
      : '两地没有已确认的现实测距基准；图上的航路只表达企划世界的相对位置。';
  const routeSubject = second.destroyed ? '残骸接近与碎片避让'
    : second.type === '无人气态巨行星' ? '云顶探测与到达制动'
      : second.uninhabited ? '无人地表测绘与着陆'
        : second.kind === 'hub' ? '跨界能力无法供现实航天使用'
          : '文明世界的真实星历尚待测定';
  return {
    tone: 'blocked',
    title: `${first.name} → ${second.name}：${routeSubject}`,
    detail: `${relationship} 从${first.name}出发，${start.departure}；到达${second.name}时，${destination.arrival}。${isSolarMixed ? '太阳系一端按当前真实星历定位，另一端仍只是原创星图的演示锚点。' : '两端坐标都属于原创星图，不能据此推断真实发射窗口。'}`,
    crewed: `无人探测：尚无到达${second.name}所需的实测导航、长期推进与制动方案。载人：跨恒星运输及生命维持能力均未具备。`,
  };
}

function renderDistanceCalculation() {
  const first = worldById.get($('#distance-from').value);
  const second = worldById.get($('#distance-to').value);
  if (!first || !second) return;
  if (first.id === second.id) {
    $('#distance-kind').textContent = '请选择两个不同的世界';
    $('#distance-value').textContent = '—';
    $('#distance-detail').textContent = '';
    $('#distance-light-time').textContent = '—';
    $('#distance-fastest-time').textContent = '—';
    $('#distance-tech-title').textContent = '起点与终点相同';
    $('#distance-tech-title').className = 'distance-tech-title special';
    $('#distance-tech-detail').textContent = '请选择另一颗星球，才能比较两地之间的距离与航行条件。';
    $('#distance-crewed').textContent = '';
    $('#distance-current').textContent = '';
    return;
  }

  const calculationTime = Date.now();
  const firstPosition = distanceVectorAtCurrentEpoch(first, calculationTime);
  const secondPosition = distanceVectorAtCurrentEpoch(second, calculationTime);
  const distanceLy = firstPosition.distanceTo(secondPosition);
  const assessment = getRealTechAssessment(first, second);
  const distanceAu = distanceLy / AU_TO_LIGHT_YEAR;
  const distanceKm = distanceAu * KILOMETERS_PER_AU;
  const bothSolar = !!(SOLAR_BODIES[first.id] && SOLAR_BODIES[second.id]);
  const samePhysicalSystem = first.system === second.system;

  $('#distance-kind').textContent = bothSolar ? '当下星历直线距离' : '企划星图直线距离估算';
  $('#distance-value').textContent = bothSolar
    ? formatDistanceKilometers(distanceKm)
    : samePhysicalSystem
      ? `约 ${formatDistanceKilometers(distanceKm)}`
      : `约 ${distanceLy < 10 ? distanceLy.toFixed(1) : Math.round(distanceLy).toLocaleString('zh-CN')} 光年`;
  $('#distance-detail').textContent = bothSolar
    ? '按当前星历计算 · 距离会随公转变化'
    : samePhysicalSystem
      ? '同一原创恒星系 · 轨道参数为企划设定'
      : `模型值 ${distanceLy.toFixed(5)} 光年 · 非现实测距`;
  $('#distance-light-time').textContent = formatLightDuration(distanceLy);
  $('#distance-fastest-time').textContent = formatFastestCraftDuration(distanceLy);
  $('#distance-tech-title').textContent = assessment.title;
  $('#distance-tech-title').className = `distance-tech-title ${assessment.tone}`;
  $('#distance-tech-detail').textContent = assessment.detail;
  $('#distance-crewed').textContent = assessment.crewed;
  $('#distance-current').textContent = `${bothSolar ? '真实太阳系星历' : '原创星图估算'} · 计算时刻 ${new Date(calculationTime).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

function populateDistanceSelects() {
  const options = worlds.map((world) => {
    const status = world.destroyed || world.ruined ? ' · 遗址' : '';
    return `<option value="${world.id}">${world.name} · ${world.region}${status}</option>`;
  }).join('');
  $('#distance-from').innerHTML = options;
  $('#distance-to').innerHTML = options;
  $('#distance-from').value = selected?.id ?? worlds[0].id;
  $('#distance-to').value = worlds.find((world) => world.id !== $('#distance-from').value)?.id ?? worlds[1].id;
}

function setSystemStarPresentation(activeSystemId = null, inFocus = false, activeWorldId = null) {
  systemMapGroup.visible = true;
  systemOrbitMapGroup.visible = true;
  for (const systemGroup of systemMapGroup.children) {
    systemGroup.visible = !inFocus || systemGroup.userData.starId !== activeSystemId;
    systemGroup.scale.setScalar(1);
  }
  for (const orbitCluster of systemOrbitMapGroup.children) {
    const isActiveCluster = inFocus && activeWorldId && orbitCluster.userData.systemId === activeSystemId;
    orbitCluster.visible = !inFocus || !!isActiveCluster;
    orbitCluster.traverse((object) => {
      const material = object.material;
      if (!material || material.userData.baseOpacity === undefined) return;
      const isSelectedOrbit = object.userData.worldId === activeWorldId;
      object.visible = !inFocus || !!isSelectedOrbit;
      material.opacity = isSelectedOrbit ? material.userData.focusOpacity : 0;
    });
  }
}

const orbitViewFrustum = new THREE.Frustum();
const orbitViewProjection = new THREE.Matrix4();
function updateOverviewOrbitVisibility() {
  if (!overviewActive) return;
  const height = Math.max(1, canvas.clientHeight);
  const focalLength = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.updateMatrixWorld();
  orbitViewFrustum.setFromProjectionMatrix(orbitViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const cluster of systemOrbitMapGroup.children) {
    const distance = camera.position.distanceTo(cluster.position);
    let anyVisible = false;
    for (const orbit of cluster.children) {
      const radiusPx = orbit.userData.radius * focalLength / Math.max(distance, 1);
      const visibility = THREE.MathUtils.smoothstep(radiusPx, 8, 28);
      orbit.visible = visibility > 0 && orbitViewFrustum.intersectsObject(orbit);
      if (!orbit.visible) continue;
      anyVisible = true;
      orbit.material.opacity = orbit.material.userData.overviewOpacity * visibility;
      const unitsPerPixel = orbit.userData.radius / Math.max(radiusPx, 1);
      orbit.material.dashSize = Math.max(1.8, unitsPerPixel * 6);
      orbit.material.gapSize = Math.max(1.2, unitsPerPixel * 4);
    }
    cluster.visible = anyVisible;
  }
}

let focusFramingActive = false;
let focusFramingBlend = 0;
let lastFramingTick = performance.now();

function updateCameraProjection() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const mobile = window.innerWidth <= 900;
  const panelHeight = window.innerWidth <= 390
    ? Math.max(286, Math.min(372, window.innerHeight * .47))
    : Math.max(286, Math.min(360, window.innerHeight * .46));
  camera.filmOffset = !mobile
    ? focusFramingBlend * 300 * camera.getFilmWidth() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height
    : 0;
  camera.updateProjectionMatrix();
  if (focusFramingBlend > 0 && mobile) {
    camera.projectionMatrix.elements[9] = -focusFramingBlend * panelHeight / height;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
}

function resizeRenderer() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  const backgroundWidth = Math.max(256, Math.floor(width * .5));
  const backgroundHeight = Math.max(192, Math.floor(height * .5));
  backgroundTarget.setSize(backgroundWidth, backgroundHeight);
  spaceBackground.material.uniforms.uResolution.value.set(
    backgroundWidth,
    backgroundHeight,
  );
  camera.aspect = width / height;
  updateCameraProjection();
  if (!overviewActive && selected && !selectedStar) controls.maxDistance = OVERVIEW_MAX_DISTANCE;
}

function setWorldContext(group) {
  group.scale.setScalar(1);
  group.traverse((object) => {
    const material = object.material;
    if (!material || material.userData.baseOpacity === undefined) return;
    material.transparent = material.userData.baseTransparent;
    material.opacity = material.userData.baseOpacity;
    if (material.uniforms?.uOpacity) {
      material.uniforms.uOpacity.value = material.userData.baseOpacity;
    }
    if (material.emissiveMap) {
      material.userData.baseEmissiveIntensity ??= material.emissiveIntensity;
      material.emissiveIntensity = material.userData.baseEmissiveIntensity;
    }
  });
}

let selected = null;
let selectedStar = null;
let overviewActive = false;
let overviewZoomAnchor = null;
const touchPointers = new Map();
let filter = 'all';
let destination = new THREE.Vector3();
let target = new THREE.Vector3();
let transitioning = true;
let transitionStartedAt = 0;
let transitionDurationMs = 1400;
let transitionBridgeDistance = 0;
const transitionStartPosition = new THREE.Vector3();
const transitionStartTarget = new THREE.Vector3();
let focusTransitionFrame = null;
let dragging = false;
let pointerStart = null;
let pendingCanvasClick = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastBackgroundRender = -Infinity;
const BACKGROUND_INTERVAL = 1 / 24;
const OVERVIEW_UNITS_PER_LY = GALAXY_SYSTEM_SCALE;
const overviewAnchors = [
  ...systemDefinitions.map((system) => ({
    id: system.id,
    name: system.starName,
    detail: `${new THREE.Vector3(...system.distanceLy).length().toFixed(1)} 光年`,
    color: system.color,
    innerReach: new THREE.Vector3(...system.distanceLy).length() < 100,
    position: new THREE.Vector3(...system.distanceLy).multiplyScalar(OVERVIEW_UNITS_PER_LY),
    open: () => focusSystem(system),
  })),
  {
    id: 'shendu', name: '圣都', detail: `${distanceAnchorByWorld.get('shendu').length().toFixed(1)} 光年`, color: '#e6c47e',
    innerReach: true,
    position: distanceAnchorByWorld.get('shendu').clone().multiplyScalar(OVERVIEW_UNITS_PER_LY),
    open: () => focus(worldById.get('shendu')),
  },
];
const innerReachAnchors = overviewAnchors.filter((anchor) => anchor.innerReach);
const innerReachCenter = innerReachAnchors.reduce((center, anchor) => center.add(anchor.position), new THREE.Vector3())
  .divideScalar(innerReachAnchors.length);
overviewAnchors.push({
  id: 'inner-reach', name: '已知近域', detail: '0–80 光年', color: '#78c3b5', innerCluster: true,
  position: innerReachCenter,
  open: () => {
    frameOverviewCamera(innerReachAnchors);
    markOverviewExploration();
  },
});
const overviewBounds = new THREE.Box3().setFromPoints(overviewAnchors.map((anchor) => anchor.position));
const overviewRadius = overviewBounds.getBoundingSphere(new THREE.Sphere()).radius;
const OVERVIEW_MAX_DISTANCE = Math.max(overviewRadius * 10, 5000000);
const overviewMarkerElements = overviewAnchors.map((anchor) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overview-marker';
  if (anchor.innerCluster) button.classList.add('overview-cluster');
  button.style.setProperty('--marker-color', anchor.color);
  button.setAttribute('aria-label', `聚焦${anchor.name}`);
  const dot = document.createElement('span');
  dot.className = 'overview-marker-dot';
  const label = document.createElement('span');
  label.className = 'overview-marker-text';
  const name = document.createElement('strong');
  name.textContent = anchor.name;
  const detail = document.createElement('small');
  detail.textContent = anchor.detail;
  label.append(name, detail);
  button.append(dot, label);
  button.addEventListener('click', anchor.open);
  $('#overview-markers').append(button);
  return button;
});

function overviewCameraFrame(anchors = overviewAnchors) {
  const bounds = new THREE.Box3().setFromPoints(anchors.map((anchor) => anchor.position));
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  const aspect = Math.max(.45, camera.aspect);
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const direction = new THREE.Vector3(.12, 1.5, .62).normalize();
  const forward = direction.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const distance = Math.max(...anchors.map((anchor) => {
    const delta = anchor.position.clone().sub(center);
    return delta.dot(direction) + Math.max(
      Math.abs(delta.dot(right)) / (tangent * aspect * .75),
      Math.abs(delta.dot(up)) / (tangent * .75),
    );
  }));
  return { center, direction, distance };
}

function frameOverviewCamera(anchors = overviewAnchors) {
  const { center, direction, distance } = overviewCameraFrame(anchors);
  focusFramingActive = false;
  focusFramingBlend = 0;
  updateCameraProjection();
  controls.minDistance = STAR_RADIUS * 24;
  controls.maxDistance = OVERVIEW_MAX_DISTANCE;
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);
  transitioning = false;
  // Flush any residual OrbitControls damping before restoring the canonical view.
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);
  controls.update();
  controls.enableDamping = damping;
}

function updateOverviewMarkers() {
  if (!overviewActive) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const placedLabels = [];
  const focalLength = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  let localSystemId = null;
  let largestLocalOrbitPx = 40;
  for (const cluster of systemOrbitMapGroup.children) {
    if (!cluster.visible) continue;
    const largestRadius = cluster.children.reduce((radius, orbit) =>
      orbit.visible ? Math.max(radius, orbit.userData.radius) : radius, 0);
    const radiusPx = largestRadius * focalLength / Math.max(camera.position.distanceTo(cluster.position), 1);
    if (radiusPx > largestLocalOrbitPx) {
      largestLocalOrbitPx = radiusPx;
      localSystemId = cluster.userData.systemId;
    }
  }
  const innerPositions = innerReachAnchors.map((anchor) => anchor.position.clone().project(camera));
  const innerSpanX = (Math.max(...innerPositions.map((point) => point.x)) - Math.min(...innerPositions.map((point) => point.x))) * width / 2;
  const innerSpanY = (Math.max(...innerPositions.map((point) => point.y)) - Math.min(...innerPositions.map((point) => point.y))) * height / 2;
  const collapseInnerReach = innerSpanX < 180 && innerSpanY < 125;
  const projectedMarkers = overviewAnchors.map((anchor, index) => {
    const projected = anchor.position.clone().project(camera);
    const radius = anchor.id === 'shendu' ? worldById.get('shendu').radius : STAR_RADIUS;
    const diameterPx = 2 * radius * height
      / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(camera.position.distanceTo(anchor.position), 1));
    const visible = (!localSystemId || anchor.id === localSystemId)
      && (anchor.innerCluster ? collapseInnerReach : !anchor.innerReach || !collapseInnerReach)
      && projected.z > -1 && projected.z < 1
      && Math.abs(projected.x) < 1.06 && Math.abs(projected.y) < 1.06
      && (anchor.innerCluster || diameterPx < 32);
    const marker = overviewMarkerElements[index];
    marker.hidden = !visible;
    if (!visible) return null;
    const x = (projected.x + 1) * width / 2;
    const y = (1 - projected.y) * height / 2;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    return { x, y, marker };
  }).filter(Boolean);
  projectedMarkers.forEach(({ x, y, marker }) => {
    const label = marker.querySelector('.overview-marker-text');
    const labelWidth = label.offsetWidth;
    const labelHeight = label.offsetHeight;
    const placements = [
      [19, -labelHeight / 2],
      [-labelWidth - 19, -labelHeight / 2],
      [-labelWidth / 2, -labelHeight - 19],
      [-labelWidth / 2, 19],
      [19, -labelHeight - 28],
      [19, 28],
      [-labelWidth - 19, -labelHeight - 28],
      [-labelWidth - 19, 28],
      [-labelWidth / 2, -labelHeight - 43],
      [-labelWidth / 2, 43],
    ];
    let best = placements[0];
    let lowestPenalty = Infinity;
    placements.forEach(([dx, dy], preference) => {
      const left = x + dx;
      const top = y + dy;
      const right = left + labelWidth;
      const bottom = top + labelHeight;
      let penalty = preference * 2;
      if (left < 12 || right > width - 12 || top < 12 || bottom > height - 12) penalty += 10000;
      for (const other of projectedMarkers) {
        const overlapWidth = Math.max(0, Math.min(right, other.x + 12) - Math.max(left, other.x - 12));
        const overlapHeight = Math.max(0, Math.min(bottom, other.y + 12) - Math.max(top, other.y - 12));
        penalty += overlapWidth * overlapHeight * 10;
      }
      for (const box of placedLabels) {
        const overlapWidth = Math.max(0, Math.min(right, box.right) - Math.max(left, box.left));
        const overlapHeight = Math.max(0, Math.min(bottom, box.bottom) - Math.max(top, box.top));
        penalty += overlapWidth * overlapHeight * 10;
      }
      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        best = [dx, dy];
      }
    });
    label.style.left = `${best[0] + 12}px`;
    label.style.top = `${best[1] + 12}px`;
    placedLabels.push({
      left: x + best[0], top: y + best[1],
      right: x + best[0] + labelWidth, bottom: y + best[1] + labelHeight,
    });
  });
}

function updateDistantStarLod() {
  const focalLength = canvas.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  for (const systemGroup of systemMapGroup.children) {
    const starCore = systemGroup.userData.starCore;
    const distance = camera.position.distanceTo(systemGroup.position);
    const diameterPx = 2 * STAR_RADIUS * systemGroup.scale.x * focalLength / Math.max(distance, 1);
    starCore.visible = true;
    const distantLight = systemGroup.userData.distantLight;
    distantLight.visible = diameterPx < 12;
    distantLight.material.opacity = .82 * THREE.MathUtils.clamp((12 - diameterPx) / 5, 0, 1);
    const pointDiameterPx = THREE.MathUtils.clamp(4.8 + Math.sqrt(diameterPx) * 1.5, 5, 10);
    distantLight.scale.setScalar(pointDiameterPx * distance / focalLength / systemGroup.scale.x);
  }
}

function markOverviewExploration() {
  if (overviewActive) $('#scene-label').textContent = '星域漫游';
}

function showOverview(preserveCamera = false) {
  if (preserveCamera) cancelTransition();
  overviewActive = true;
  overviewZoomAnchor = null;
  focusFramingActive = false;
  if (!preserveCamera) focusFramingBlend = 0;
  document.querySelector('#app').classList.add('overview-mode');
  $('#overview-btn').setAttribute('aria-pressed', 'true');
  $('#focus-btn').setAttribute('aria-pressed', 'false');
  document.querySelectorAll('.planet-item.selected').forEach((button) => button.classList.remove('selected'));
  galaxyGroup.visible = true;
  setSystemStarPresentation();
  for (const group of worldGroups.values()) group.visible = true;
  focusStarGroup.visible = false;
  orbitGroup.visible = false;
  coreStar.visible = false;
  galaxyBackdrop.visible = false;
  nebulaGroup.visible = false;
  deepSkySprite.visible = false;
  controls.enablePan = true;
  controls.minDistance = preserveCamera ? 8 : STAR_RADIUS * 24;
  camera.far = OVERVIEW_MAX_DISTANCE * 2;
  updateCameraProjection();
  controls.zoomSpeed = 1.5;
  controls.maxDistance = OVERVIEW_MAX_DISTANCE;
  resizeRenderer();
  if (!preserveCamera) frameOverviewCamera();
  $('#scene-label').textContent = preserveCamera ? '星域漫游' : '星域总览';
  $('#scene-title').textContent = '原创宇宙';
  $('#scene-subtitle').textContent = `${systemDefinitions.length}处恒星系 · 圣都航路中枢`;
  $('#status-text').textContent = '星际坐标';
  $('#catalog').classList.remove('open');
  updateOverviewMarkers();
}

function leaveOverview() {
  if (!overviewActive) return;
  overviewActive = false;
  overviewZoomAnchor = null;
  document.querySelector('#app').classList.remove('overview-mode');
  $('#overview-btn').setAttribute('aria-pressed', 'false');
  $('#focus-btn').setAttribute('aria-pressed', 'true');
  controls.minDistance = 8;
  camera.far = OVERVIEW_MAX_DISTANCE * 2;
  updateCameraProjection();
  resizeRenderer();
}

function settleTransition() {
  if (!transitioning) return;
  if (!overviewActive && selected && !selectedStar) {
    const liveCenter = worldGroups.get(selected.id)?.position;
    if (liveCenter) {
      destination.add(liveCenter.clone().sub(target));
      target.copy(liveCenter);
    }
  }
  camera.position.copy(destination);
  controls.target.copy(target);
  transitioning = false;
  controls.update();
}

function beginTransition(durationMs = 1400) {
  transitionStartPosition.copy(camera.position);
  transitionStartTarget.copy(controls.target);
  transitionStartedAt = performance.now();
  const separation = transitionStartTarget.distanceTo(target);
  transitionBridgeDistance = separation > 24 && separation < 50000
    ? Math.max(
      transitionStartPosition.distanceTo(transitionStartTarget),
      destination.distanceTo(target),
      separation * 2.5,
    )
    : 0;
  transitionDurationMs = transitionBridgeDistance ? 1600 : durationMs;
  transitioning = true;
}

function blendDistantFocus() {
  focusTransitionFrame?.remove();
  renderer.render(scene, camera);
  const image = new Image();
  image.className = 'focus-transition-frame';
  image.src = canvas.toDataURL('image/webp', .82);
  const bounds = canvas.getBoundingClientRect();
  Object.assign(image.style, {
    left: `${bounds.left}px`, top: `${bounds.top}px`,
    width: `${bounds.width}px`, height: `${bounds.height}px`,
  });
  document.querySelector('#app').append(image);
  focusTransitionFrame = image;
  requestAnimationFrame(() => { image.style.opacity = '0'; });
  window.setTimeout(() => {
    image.remove();
    if (focusTransitionFrame === image) focusTransitionFrame = null;
  }, 750);
}

function cancelTransition() {
  if (!transitioning) return;
  destination.copy(camera.position);
  target.copy(controls.target);
  transitioning = false;
}

function prepareOverviewZoom(clientX, clientY) {
  if (!overviewActive) return;
  // A previously focused body already provides a physical zoom target.
  const previousCenter = selected
    ? worldGroups.get(selected.id)?.position
    : selectedStar ? sceneSystemPosition(selectedStar) : null;
  if (previousCenter && controls.target.distanceTo(previousCenter) < (selected?.radius ?? STAR_RADIUS) * 4) return;

  if (!overviewZoomAnchor) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const cursor = new THREE.Vector2(
      clientX === undefined ? 0 : (clientX - bounds.left) / bounds.width * 2 - 1,
      clientY === undefined ? 0 : 1 - (clientY - bounds.top) / bounds.height * 2,
    );
    camera.updateMatrixWorld();
    let closestDistance = Infinity;
    for (const anchor of overviewAnchors) {
      if (!starById.has(anchor.id)) continue;
      const projected = anchor.position.clone().project(camera);
      if (projected.z <= -1 || projected.z >= 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
      const screenDistance = Math.hypot(
        (projected.x - cursor.x) * bounds.width,
        (projected.y - cursor.y) * bounds.height,
      );
      if (screenDistance < closestDistance) {
        closestDistance = screenDistance;
        overviewZoomAnchor = anchor;
      }
    }
  }
  if (!overviewZoomAnchor) return;
  // The overview's bounding-box center can be empty space. Keep the camera
  // in place, but aim subsequent zoom steps at a real star instead of it.
  controls.target.copy(overviewZoomAnchor.position);
  controls.minDistance = 8;
  controls.update();
}

function nudgeCameraDistance(multiplier) {
  cancelTransition();
  if (multiplier < 1) prepareOverviewZoom();
  else overviewZoomAnchor = null;
  const offset = camera.position.clone().sub(controls.target);
  const currentDistance = offset.length();
  if (currentDistance < .001) return;
  if (multiplier > 1 && !overviewActive && currentDistance * multiplier >= localFocusDistance()) showOverview(true);
  const nextDistance = THREE.MathUtils.clamp(
    currentDistance * multiplier,
    controls.minDistance,
    controls.maxDistance,
  );
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(nextDistance));
  transitioning = false;
  markOverviewExploration();
}

function renderDetailProfile(title, items) {
  $('#detail-profile-heading').textContent = title;
  const container = $('#detail-profile');
  container.replaceChildren(...items.map(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'profile-row';
    const name = document.createElement('span');
    name.className = 'profile-label';
    name.textContent = label;
    const detail = document.createElement('strong');
    detail.textContent = value;
    row.append(name, detail);
    return row;
  }));
}

function maxPlanetCameraDistance(world) {
  const viewHeight = Math.max(320, canvas.clientHeight);
  const minDiameterPx = window.innerWidth <= 900 ? 20 : 18;
  return Math.max(120, world.radius * viewHeight / (minDiameterPx * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
}

function localFocusDistance() {
  if (selected && !selectedStar) return maxPlanetCameraDistance(selected);
  if (selectedStar) {
    return Math.max(300, ...worlds
      .filter((world) => world.system === selectedStar.name)
      .map((world) => sceneWorldPosition(world).distanceTo(sceneSystemPosition(selectedStar)) * 2.5));
  }
  return 1200;
}

function restoreNearbyFocus() {
  if (!overviewActive) return;
  if (overviewZoomAnchor
    && controls.target.distanceTo(overviewZoomAnchor.position) < STAR_RADIUS * 4
    && camera.position.distanceTo(controls.target) < 250) {
    focusSystem(starById.get(overviewZoomAnchor.id), true, true);
    return;
  }
  if (selected) {
    const center = worldGroups.get(selected.id)?.position;
    if (center && controls.target.distanceTo(center) < selected.radius * 4
      && camera.position.distanceTo(controls.target) < maxPlanetCameraDistance(selected) * .72) {
      focus(selected, true, true);
    }
  } else if (selectedStar) {
    const center = sceneSystemPosition(selectedStar);
    if (controls.target.distanceTo(center) < STAR_RADIUS * 4
      && camera.position.distanceTo(controls.target) < 250) {
      focusSystem(selectedStar, true, true);
    }
  }
}

function focus(world, instant = false, preserveCamera = false) {
  if (!world) return;
  const base = physicalWorldPosition(world);
  const previousCameraPosition = preserveCamera ? camera.position.clone() : null;
  const previousTarget = preserveCamera ? controls.target.clone() : null;
  const distantTravel = !preserveCamera && camera.position.distanceTo(base) > 50000;
  if (distantTravel && !instant) blendDistantFocus();
  leaveOverview();
  focusFramingActive = true;
  updateCameraProjection();
  selected = world;
  selectedStar = null;
  controls.enablePan = false;
  controls.maxDistance = OVERVIEW_MAX_DISTANCE;
  galaxyGroup.visible = true;
  orbitGroup.visible = false;
  const systemDefinition = systemByName.get(world.system);
  setSystemStarPresentation(
    systemDefinition?.id ?? null,
    true,
    world.id,
  );
  for (const group of worldGroups.values()) {
    group.visible = true;
    setWorldContext(group);
  }
  focusStarGroup.visible = false;
  coreStar.visible = false;
  galaxyBackdrop.visible = false;
  nebulaGroup.visible = false;
  deepSkySprite.visible = false;
  galaxyBackdrop.material.opacity = .12;
  const systemPosition = systemPositions.get(world.system);
  focusStarGroup.visible = !!systemPosition;
  if (systemPosition) focusStarGroup.position.copy(systemPosition);
  if (systemDefinition) {
    focusStarMaterial.uniforms.uColor.value.set(systemDefinition.color);
    focusStar.material.color.set(systemDefinition.light);
    focusStarGroup.scale.setScalar((systemDefinition.starRadius ?? STAR_RADIUS) / STAR_RADIUS);
  }
  // 行星聚焦必须把行星本身作为 controls.target；恒星只作为空间参照物保留在视野边缘。
  // 之前使用恒星与行星的中点，会让镜头停在两者之间，导致详情虽切换但行星不在画面中心。
  const focusCenter = base.clone();
  const focusDirection = camera.position.clone().sub(controls.target);
  if (focusDirection.lengthSq() < .0001) focusDirection.set(0, .9, .35);
  // 参考 Star 宇宙的太阳系取景：从水平轨道面上方观察，
  // 让 XZ 轨道在画面里保持横向，而不是沿深度方向压成竖向弧线。
  if (distantTravel && systemPosition) {
    const towardStar = systemPosition.clone().sub(base).normalize();
    const elevatedView = world.type === '无人气态巨行星'
      ? new THREE.Vector3(0, .22, .97).normalize()
      : new THREE.Vector3(0, .9, .35).normalize();
    const sideView = elevatedView.addScaledVector(towardStar, -elevatedView.dot(towardStar)).normalize();
    focusDirection.copy(towardStar.multiplyScalar(.55).addScaledVector(sideView, .835));
  }
  focusDirection.normalize();
  const focusDistance = Math.max(28, world.radius * 8);
  target.copy(focusCenter);
  const mobileDistanceFactor = world.id === 'saturn' ? 1.7 : world.id === 'uranus' ? 1.12 : world.kind === 'hub' ? 1.12 : .94;
  if (preserveCamera) destination.copy(previousCameraPosition).add(base.clone().sub(previousTarget));
  else destination.copy(focusCenter).addScaledVector(focusDirection,
    window.innerWidth <= 900 ? focusDistance * mobileDistanceFactor : focusDistance,
  );
  if (distantTravel && !instant) {
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(focusDirection, Math.max(300, focusDistance * 6));
  }
  beginTransition(distantTravel ? 1100 : 1400);
  if (instant) settleTransition();
  applySceneLighting();
  $('#scene-label').textContent = `当前焦点 / ${world.name}`;
  $('#scene-title').textContent = world.name;
  $('#scene-subtitle').textContent = `${world.subtitle} · ${world.region} · ${world.distance}`;
  $('#detail-index').textContent = `${String(worlds.indexOf(world) + 1).padStart(2, '0')} / ${String(worlds.length).padStart(2, '0')}`;
  $('#detail-swatch').style.setProperty('--swatch', world.color);
  $('#detail-type').textContent = world.type;
  $('#detail-name').textContent = world.name;
  $('#detail-desc').textContent = world.description;
  $('.detail').scrollTop = 0;
  const orbitalState = planetOrbitStates.get(world.id);
  const motionProfile = [
    ['自转周期', `${Math.abs(world.rotationHours).toLocaleString('zh-CN')} 小时${world.rotationHours < 0 ? ' · 逆行' : ''}`],
    ['自转轴倾角', `${world.axialTiltDeg.toFixed(1)}°`],
  ];
  if (orbitalState) {
    motionProfile.unshift(['公转周期', `${orbitalState.periodDays.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 地球日`]);
  }
  renderDetailProfile('星球内部档案', [...motionProfile, ...(world.profile ?? [])]);
  $('#detail-field-arc').textContent = '关联企划';
  $('#detail-field-region').textContent = '恒星系 / 叙事星域';
  $('#detail-field-distance').textContent = '航路尺度';
  $('#detail-field-places').textContent = '已知地点';
  $('#detail-arc').textContent = world.arc;
  $('#detail-region').textContent = `${world.system} · ${world.region}`;
  $('#detail-distance').textContent = world.distance;
  $('#detail-places').replaceChildren(...world.places.map((name) => {
    const tag = document.createElement('span');
    tag.className = 'place';
    tag.textContent = name;
    return tag;
  }));
  $('#status-text').textContent = `已定位 · ${world.name}`;
  $('#next-btn').innerHTML = '下一处世界 <i data-lucide="arrow-right"></i>';
  document.querySelectorAll('.planet-item').forEach((button) => button.classList.toggle('selected', button.dataset.kind !== 'star' && button.dataset.id === world.id));
  $('#catalog').classList.remove('open');
  window.lucide?.createIcons();
}

function focusSystem(system, instant = false, preserveCamera = false) {
  if (!system) return;
  const starPosition = sceneSystemPosition(system);
  const distantTravel = camera.position.distanceTo(starPosition) > 50000;
  if (distantTravel && !instant) blendDistantFocus();
  const previousCameraPosition = preserveCamera ? camera.position.clone() : null;
  leaveOverview();
  focusFramingActive = true;
  updateCameraProjection();
  selectedStar = system;
  selected = null;
  controls.enablePan = false;
  galaxyGroup.visible = true;
  orbitGroup.visible = false;
  galaxyBackdrop.visible = false;
  nebulaGroup.visible = false;
  deepSkySprite.visible = false;
  setSystemStarPresentation(system.id, true, null);
  focusStarGroup.visible = true;
  focusStarGroup.position.copy(sceneSystemPosition(system));
  // 恒星聚焦保持足够的视觉尺度，避免缩放后只剩光点。
  focusStarGroup.scale.setScalar(1);
  focusStarMaterial.uniforms.uColor.value.set(system.color);
  focusStar.material.color.set(system.light);
  for (const group of worldGroups.values()) {
    group.visible = true;
    setWorldContext(group);
  }
  target.copy(starPosition);
  const starFocusDistance = 125;
  controls.maxDistance = OVERVIEW_MAX_DISTANCE;
  // 恒星聚焦展示恒星本体；行星成员通过目录各自聚焦。
  if (preserveCamera) destination.copy(previousCameraPosition);
  else {
    const viewDirection = distantTravel
      ? new THREE.Vector3(2, 2.5, starFocusDistance).normalize()
      : camera.position.clone().sub(controls.target).normalize();
    destination.copy(starPosition).addScaledVector(viewDirection, starFocusDistance);
  }
  if (distantTravel && !instant) {
    const viewDirection = destination.clone().sub(target).normalize();
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(viewDirection, Math.max(500, starFocusDistance * 4));
  }
  beginTransition(distantTravel ? 1100 : 1400);
  if (instant) settleTransition();
  $('#scene-label').textContent = `当前焦点 / ${system.starName}`;
  $('#scene-title').textContent = system.starName;
  $('#scene-subtitle').textContent = `${system.subtitle} · ${system.name}`;
  $('#detail-index').textContent = `${String(systemDefinitions.indexOf(system) + 1).padStart(2, '0')} / ${String(systemDefinitions.length).padStart(2, '0')}`;
  $('#detail-swatch').style.setProperty('--swatch', system.color);
  $('#detail-type').textContent = system.id === 'yanyao' ? '太阳' : '导航恒星';
  $('#detail-name').textContent = system.starName;
  $('#detail-desc').textContent = system.description;
  $('.detail').scrollTop = 0;
  renderDetailProfile('导航分组结构', [
    ['恒星性质', system.subtitle.replace(' · ', '，')],
    ['航路职责', system.description.split('，')[0]],
    ['观测重点', system.description.split('，').slice(1).join('，') || '原创星图导航节点'],
  ]);
  $('#detail-field-arc').textContent = '恒星成员';
  $('#detail-field-region').textContent = '导航分组';
  $('#detail-field-distance').textContent = '恒星类型';
  $('#detail-field-places').textContent = '行星成员';
  $('#detail-arc').textContent = worlds.filter((world) => world.system === system.name).map((world) => world.name).join('、') || '暂无已标记行星';
  $('#detail-region').textContent = system.name;
  $('#detail-distance').textContent = system.id === 'yanyao'
    ? '太阳 · 物理参数已知'
    : '原创导航坐标 · 物理参数采用演示值';
  $('#detail-places').replaceChildren(...worlds.filter((world) => world.system === system.name).map((world) => {
    const tag = document.createElement('span');
    tag.className = 'place';
    tag.textContent = world.name;
    return tag;
  }));
  $('#status-text').textContent = `已定位 · ${system.starName}`;
  $('#next-btn').innerHTML = '下一颗恒星 <i data-lucide="arrow-right"></i>';
  document.querySelectorAll('.planet-item').forEach((button) => button.classList.toggle('selected', button.dataset.kind === 'star' && button.dataset.id === system.id));
  $('#catalog').classList.remove('open');
  applySceneLighting();
  window.lucide?.createIcons();
}

function renderList() {
  const container = $('#planet-list');
  container.replaceChildren();
  const query = $('#search').value.trim().toLowerCase();
  const matchingStars = filter === 'all'
    ? systemDefinitions.filter((system) => `${system.starName} ${system.name} ${system.subtitle}`.toLowerCase().includes(query))
    : [];
  if (matchingStars.length) {
    const heading = document.createElement('div');
    heading.className = 'group-label';
    heading.textContent = '恒星';
    container.append(heading);
    for (const system of matchingStars) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `planet-item${!overviewActive && selectedStar?.id === system.id ? ' selected' : ''}`;
      button.dataset.id = system.id;
      button.dataset.kind = 'star';
      const starMeta = system.id === 'yanyao' ? `${system.name} · 太阳` : `${system.name} · 导航恒星`;
      button.innerHTML = `<span class="planet-dot star-dot" style="--dot:${system.color}"></span><span><strong>${system.starName}</strong><small>${starMeta}</small></span><span class="chevron" aria-hidden="true">›</span>`;
      button.addEventListener('click', () => focusSystem(system));
      container.append(button);
    }
  }
  const list = worlds.filter((world) => {
    if (filter === 'civilized' && (world.destroyed || world.ruined || world.uninhabited)) return false;
    if (filter === 'ruins' && !world.destroyed && !world.ruined) return false;
    if (filter === 'uninhabited' && !world.uninhabited) return false;
    return `${world.name} ${world.arc} ${world.region} ${world.system} ${world.places.join(' ')}`.toLowerCase().includes(query);
  });
  const groupedWorlds = new Map();
  for (const world of list) {
    const catalogGroup = world.system === '地球航路'
      ? '太阳系'
      : world.system === '跨宇宙中枢'
        ? '跨宇宙中枢（无固定恒星）'
        : world.system;
    if (!groupedWorlds.has(catalogGroup)) {
      groupedWorlds.set(catalogGroup, []);
    }
    groupedWorlds.get(catalogGroup).push(world);
  }
  for (const [catalogGroup, group] of groupedWorlds) {
      const heading = document.createElement('div');
      heading.className = 'group-label';
      heading.textContent = catalogGroup;
      container.append(heading);
      for (const world of group) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `planet-item${!overviewActive && selected?.id === world.id ? ' selected' : ''}`;
        button.dataset.id = world.id;
        button.dataset.kind = 'world';
        button.innerHTML = `<span class="planet-dot" style="--dot:${world.color}"></span><span><strong>${world.name}</strong><small>${world.region} · ${world.arc}</small></span><span class="chevron" aria-hidden="true">›</span>`;
        button.addEventListener('click', () => focus(world));
        container.append(button);
      }
  }
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'group-label';
    empty.textContent = '没有匹配的星球';
    container.append(empty);
  }
}

$('#search').addEventListener('input', renderList);
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
  renderList();
}));
$('#overview-btn').addEventListener('click', () => {
  if (!overviewActive) blendDistantFocus();
  showOverview();
});
$('#focus-btn').addEventListener('click', () => selectedStar ? focusSystem(selectedStar) : focus(selected ?? worldById.get('lumila')));
$('#reset-btn').addEventListener('click', () => overviewActive ? showOverview() : selectedStar ? focusSystem(selectedStar) : focus(selected ?? worldById.get('lumila')));
$('#next-btn').addEventListener('click', () => {
  if (selectedStar) {
    focusSystem(systemDefinitions[(systemDefinitions.indexOf(selectedStar) + 1) % systemDefinitions.length]);
    return;
  }
  focus(worlds[(worlds.indexOf(selected) + 1) % worlds.length]);
});
$('#distance-btn').addEventListener('click', () => {
  populateDistanceSelects();
  renderDistanceCalculation();
  $('#distance-modal').showModal();
  window.lucide?.createIcons();
});
$('#distance-close').addEventListener('click', () => $('#distance-modal').close());
$('#distance-from').addEventListener('change', renderDistanceCalculation);
$('#distance-to').addEventListener('change', renderDistanceCalculation);
$('#menu-btn').addEventListener('click', () => $('#catalog').classList.toggle('open'));
$('#zoom-in').addEventListener('click', () => nudgeCameraDistance(1 / 1.5));
$('#zoom-out').addEventListener('click', () => nudgeCameraDistance(1.5));
canvas.addEventListener('wheel', (event) => {
  cancelTransition();
  if (event.deltaY < 0) prepareOverviewZoom(event.clientX, event.clientY);
  else if (event.deltaY > 0) overviewZoomAnchor = null;
  if (event.deltaY > 0 && !overviewActive
    && camera.position.distanceTo(controls.target) >= localFocusDistance() * .9) showOverview(true);
  markOverviewExploration();
}, { capture: true, passive: false });
$('#overview-markers').addEventListener('wheel', (event) => {
  event.preventDefault();
  canvas.dispatchEvent(new WheelEvent('wheel', {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaMode: event.deltaMode,
    clientX: event.clientX,
    clientY: event.clientY,
    ctrlKey: event.ctrlKey,
    cancelable: true,
  }));
}, { passive: false });
function pickCanvasTarget(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...meshes.values(), ...starPickTargets], false)[0];
  if (!hit) return;
  if (hit.object.userData.starId) {
    focusSystem(starById.get(hit.object.userData.starId));
    return;
  }
  const world = worldById.get(hit.object.userData.worldId);
  if (world) focus(world);
}

canvas.addEventListener('pointerdown', (event) => {
  cancelTransition();
  overviewZoomAnchor = null;
  if (event.pointerType === 'touch') touchPointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
}, { capture: true });
canvas.addEventListener('pointermove', (event) => {
  if (!touchPointers.has(event.pointerId)) return;
  const points = [...touchPointers.values()];
  const previousSpan = points.length === 2 ? points[0].distanceTo(points[1]) : 0;
  touchPointers.get(event.pointerId).set(event.clientX, event.clientY);
  if (points.length !== 2 || !previousSpan) return;
  const nextSpan = points[0].distanceTo(points[1]);
  if (nextSpan > previousSpan) {
    const midpoint = points[0].clone().add(points[1]).multiplyScalar(.5);
    prepareOverviewZoom(midpoint.x, midpoint.y);
  } else if (nextSpan < previousSpan) {
    overviewZoomAnchor = null;
    if (!overviewActive && camera.position.distanceTo(controls.target) >= localFocusDistance() * .9) showOverview(true);
  }
  markOverviewExploration();
}, { capture: true });
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(eventName, (event) => touchPointers.delete(event.pointerId), { capture: true });
}
canvas.addEventListener('pointerdown', (event) => {
  if (pendingCanvasClick !== null) window.clearTimeout(pendingCanvasClick);
  pendingCanvasClick = null;
  pointerStart = [event.clientX, event.clientY];
  dragging = false;
});
canvas.addEventListener('pointermove', (event) => {
  if (pointerStart && Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) {
    dragging = true;
    markOverviewExploration();
  }
});
canvas.addEventListener('pointerup', (event) => {
  pointerStart = null;
  if (dragging) return;
  const clientX = event.clientX;
  const clientY = event.clientY;
  if (pendingCanvasClick !== null) window.clearTimeout(pendingCanvasClick);
  pendingCanvasClick = window.setTimeout(() => {
    pendingCanvasClick = null;
    pickCanvasTarget(clientX, clientY);
  }, 180);
});
canvas.addEventListener('dblclick', (event) => {
  event.preventDefault();
  if (pendingCanvasClick !== null) window.clearTimeout(pendingCanvasClick);
  pendingCanvasClick = null;
  pickCanvasTarget(event.clientX, event.clientY);
});
window.addEventListener('resize', resizeRenderer);

function renderBackground(elapsed) {
  if (elapsed - lastBackgroundRender < BACKGROUND_INTERVAL) return;
  lastBackgroundRender = elapsed;
  camera.updateMatrixWorld();
  spaceBackground.material.uniforms.uTime.value = elapsed;
  spaceBackground.material.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
  spaceBackground.material.uniforms.uCameraRotation.value.setFromMatrix4(camera.matrixWorld);
  renderer.setRenderTarget(backgroundTarget);
  renderer.render(backgroundScene, backgroundCamera);
  renderer.setRenderTarget(null);
}

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const currentTimeMs = Date.now();
  const elapsed = now * 0.001;
  const framingDelta = Math.max(0, (now - lastFramingTick) * 0.001);
  lastFramingTick = now;
  const framingTarget = focusFramingActive ? 1 : 0;
  if (Math.abs(focusFramingBlend - framingTarget) > .001) {
    focusFramingBlend = THREE.MathUtils.damp(focusFramingBlend, framingTarget, 9, framingDelta);
    updateCameraProjection();
  } else if (focusFramingBlend !== framingTarget) {
    focusFramingBlend = framingTarget;
    updateCameraProjection();
  }
  renderBackground(elapsed);
  updatePlanetOrbits(currentTimeMs);
  updateWorldSpins(currentTimeMs);
  updateFocusPlanetLight();
  if (!overviewActive && selected && !selectedStar) {
    const liveCenter = worldGroups.get(selected.id)?.position;
    if (liveCenter) {
      if (transitioning) {
        destination.add(liveCenter.clone().sub(target));
        target.copy(liveCenter);
      } else {
        camera.position.add(liveCenter.clone().sub(controls.target));
        controls.target.copy(liveCenter);
        target.copy(liveCenter);
        destination.copy(camera.position);
      }
    }
  }
  for (const material of starMaterials) material.uniforms.uTime.value = elapsed;
  for (const material of ringMaterials) material.uniforms.uTime.value = elapsed;
  if (transitioning) {
    const progress = THREE.MathUtils.clamp((performance.now() - transitionStartedAt) / transitionDurationMs, 0, 1);
    if (transitionBridgeDistance) {
      const viewDirection = transitionStartPosition.clone().sub(transitionStartTarget).normalize();
      if (progress < .28) {
        const step = THREE.MathUtils.smoothstep(progress, 0, .28);
        camera.position.copy(transitionStartTarget).addScaledVector(
          viewDirection,
          THREE.MathUtils.lerp(transitionStartPosition.distanceTo(transitionStartTarget), transitionBridgeDistance, step),
        );
        controls.target.copy(transitionStartTarget);
      } else if (progress < .72) {
        const step = THREE.MathUtils.smoothstep(progress, .28, .72);
        controls.target.lerpVectors(transitionStartTarget, target, step);
        camera.position.copy(controls.target).addScaledVector(viewDirection, transitionBridgeDistance);
      } else {
        const step = THREE.MathUtils.smoothstep(progress, .72, 1);
        controls.target.copy(target);
        const bridgePosition = target.clone().addScaledVector(viewDirection, transitionBridgeDistance);
        camera.position.lerpVectors(bridgePosition, destination, step);
      }
    } else {
      const eased = 1 - (1 - progress) ** 3;
      camera.position.lerpVectors(transitionStartPosition, destination, eased);
      controls.target.lerpVectors(transitionStartTarget, target, eased);
    }
    if (progress === 1) {
      camera.position.copy(destination);
      controls.target.copy(target);
      transitioning = false;
    }
  }
  applySceneLighting();
  constrainFocusStarGlow();
  updateDistantStarLod();
  controls.update();
  restoreNearbyFocus();
  const cameraDistance = camera.position.distanceTo(controls.target);
  const near = Math.max(.1, cameraDistance * .00002);
  // 聚焦和总览共用星际远裁剪面，避免切换模式时远方恒星突然消失。
  const far = OVERVIEW_MAX_DISTANCE * 2;
  if (Math.abs(near - camera.near) > camera.near * .01 || Math.abs(far - camera.far) > camera.far * .01) {
    camera.near = near;
    camera.far = far;
    updateCameraProjection();
  }
  updateOverviewOrbitVisibility();
  updateOverviewMarkers();
  renderer.render(scene, camera);
}

camera.far = 1e12;
camera.position.set(-23, 13, 40);
controls.target.set(-25, 11, -7);
resizeRenderer();
renderList();
showOverview();
updatePlanetOrbits(Date.now());
updateWorldSpins(Date.now());
frame();
window.addEventListener('load', () => window.lucide?.createIcons());
window.__arsAtlas = {
  worlds,
  stars: systemDefinitions,
  select: (id) => focus(worldById.get(id)),
  selectStar: (id) => focusSystem(starById.get(id)),
  showOverview,
  getNavigationSnapshot: () => ({
    overview: overviewActive,
    selectedId: selected?.id ?? selectedStar?.id ?? null,
    zoomAnchorId: overviewZoomAnchor?.id ?? null,
    target: controls.target.toArray(),
    distance: camera.position.distanceTo(controls.target),
    minDistance: controls.minDistance,
  }),
  getOrbitSnapshot: (epochMs = Date.now()) => [...planetOrbitStates.entries()].map(([id, state]) => ({
    id,
    position: orbitPositionAtDays(state, (epochMs - J2000_MS) / DAY_MS).toArray(),
    periodDays: state.periodDays,
    semiMajorAU: state.semiMajorAU,
    eccentricity: state.eccentricity,
  })),
  getSpinSnapshot: (epochMs = Date.now()) => worlds.map((world) => ({
    id: world.id,
    rotationHours: world.rotationHours,
    axialTiltDeg: world.axialTiltDeg,
    angle: rotationAngleAtTime(world, epochMs),
  })),
  renderer,
  camera,
};
