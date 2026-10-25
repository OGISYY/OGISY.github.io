/* ==================================================================
   hero-scene.js | Escena 3D del hero
   Three.js r170 como modulo ES (importmap en index.html), sin build.
   Alojado en el repo: js/lib/three-0.170.0/ (build/, loaders, utils y el
   decodificador Draco), sin dependencias de CDN.

   Que hay en escena:
   - Campanario gotico con una campana de hierro (procedural) que oscila
   - Luz calida de brasa desde abajo + un haz volumetrico desde el arco
   - Brasas y polvo ascendiendo (shader de particulas, guino a Niagara)
   - Tarjetas de niebla y skyline de agujas recortado contra un resplandor

   Rendimiento:
   - pixelRatio maximo 2 (1.5 en movil), sin antialias en pantallas densas
   - Se pausa fuera de pantalla (IntersectionObserver) y con la pestana oculta
   - prefers-reduced-motion: un unico fotograma estatico, sin parallax
   - Pocas draw calls: skyline con InstancedMesh, particulas en un Points

   SUSTITUIR LA CAMPANA POR TU .GLB DE BLENDER
   1. En Blender: File > Export > glTF 2.0 (.glb)
      - Include: Selected Objects | Transform: +Y Up | Mesh: Apply Modifiers
      - Compression (Draco): activado, nivel 6
      - Pon el origen del objeto en el punto de cuelgue (arriba de la corona)
   2. Copia el archivo, por ejemplo, a media/3d/bell.glb
   3. Cambia CONFIG.bellModel abajo a 'media/3d/bell.glb'
   El cargador (GLTFLoader + DRACOLoader) solo se descarga si hay modelo.
   El modelo se normaliza a la escala de la campana procedural; si falla
   la carga, se mantiene la procedural.
   ================================================================== */

import * as THREE from 'three';

export const CONFIG = {
  // Si activas el .glb con Draco, la CSP de index.html necesita ademas:
  // 'wasm-unsafe-eval' en script-src, worker-src 'self' blob: y blob: en img-src.
  bellModel: null, // p. ej. 'media/3d/bell.glb'
  dracoDecoderPath: 'js/lib/three-0.170.0/examples/jsm/libs/draco/gltf/', // relativa a index.html
  maxPixelRatio: 2,
  bg: 0x0d0b0a,
  ember: 0xff7a2e,
};

/* ---------- Utilidades ---------- */
function rng(seed) {
  // mulberry32: aleatorio reproducible para que la composicion sea estable
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ---------- Entorno para reflejos del metal (barato, sin HDRI) ---------- */
function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0b0908);
  const panel = (color, strength, y, rotX, size) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide })
    );
    m.position.y = y;
    m.rotation.x = rotX;
    env.add(m);
  };
  panel(0xff8a3c, 2.2, -3, -Math.PI / 2, 6);  // brasas abajo
  panel(0x9fb0c8, 0.35, 4, Math.PI / 2, 8);   // cielo frio y tenue arriba
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

/* ---------- Campana procedural ---------- */
function buildBell(material) {
  // Perfil (radio, altura): interior de arriba a abajo, labio, exterior de abajo a arriba
  const profile = [
    [0.0, 0.86], [0.3, 0.85], [0.38, 0.78], [0.4, 0.62], [0.43, 0.42], [0.5, 0.24], [0.6, 0.1],
    [0.68, 0.03], [0.72, 0.0], [0.76, 0.0], [0.78, 0.02], [0.77, 0.05], [0.7, 0.11], [0.6, 0.2],
    [0.52, 0.32], [0.47, 0.48], [0.45, 0.64], [0.44, 0.78], [0.4, 0.9], [0.3, 0.97], [0.15, 1.0], [0.0, 1.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const bell = new THREE.Group();
  bell.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 64), material));

  const band = (r, y, tube) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 64), material);
    m.rotation.x = Math.PI / 2;
    m.position.y = y;
    return m;
  };
  bell.add(band(0.737, 0.075, 0.02), band(0.565, 0.27, 0.012), band(0.452, 0.8, 0.012));

  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 24), material);
  crown.position.y = 1.08;
  bell.add(crown);

  const clapper = new THREE.Group();
  clapper.position.y = 0.84;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8), material);
  rod.position.y = -0.31;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), material);
  ball.position.y = -0.66;
  clapper.add(rod, ball);
  bell.add(clapper);

  bell.position.y = -1.235; // la parte superior de la corona queda en el punto de cuelgue
  bell.userData.clapper = clapper;
  return bell;
}

/* ---------- Campanario: arco apuntado, viga y herrajes ---------- */
function buildBelfry(stone, iron) {
  const g = new THREE.Group();
  const W = 3.0;            // ancho exterior
  const hs = 1.1;           // medio vano del arco
  const r = hs * 2;         // arco apuntado equilatero
  const spring = 2.4;       // altura de arranque del arco
  const H = spring + Math.sqrt(3) * hs + 0.6;

  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(-hs, 0);
  s.lineTo(-hs, spring);
  s.absarc(hs, spring, r, Math.PI, (Math.PI * 2) / 3, true);
  s.absarc(-hs, spring, r, Math.PI / 3, 0, true);
  s.lineTo(hs, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, H);
  s.lineTo(-W / 2, H);
  s.lineTo(-W / 2, 0);

  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 20 }),
    stone
  );
  frame.position.set(0, -3.08, -0.75);
  g.add(frame);

  // Impostas en el arranque del arco
  [-1, 1].forEach((side) => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.62), stone);
    cap.position.set(side * (hs + 0.08), -3.08 + spring, -0.5);
    g.add(cap);
  });

  // Viga y herrajes de los que cuelga la campana
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.24), iron);
  beam.position.set(0, 0.12, -0.05);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.28), iron);
  strap.position.set(0, 0.0, -0.05);
  g.add(beam, strap);
  return g;
}

/* ---------- Shaders ---------- */
const particleVert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHeight;
  uniform float uSpeed;
  uniform float uScale;
  attribute vec4 aSeed; // x: fase, y: velocidad, z: tamano, w: deriva
  varying float vLife;
  varying float vFlicker;
  void main() {
    vec3 p = position;
    float y = mod(p.y + uTime * aSeed.y * uSpeed, uHeight);
    vLife = y / uHeight;
    p.y = y - uHeight * 0.5;
    float ph = aSeed.x * 6.2831;
    p.x += sin(uTime * 0.6 + ph) * aSeed.w + sin(uTime * 1.7 + ph * 3.0) * 0.06;
    p.z += cos(uTime * 0.45 + ph) * aSeed.w * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vFlicker = 0.6 + 0.4 * sin(uTime * (2.5 + aSeed.x * 6.0) + ph * 7.0);
    gl_PointSize = aSeed.z * uPixelRatio * uScale * (1.0 - vLife * 0.55) / -mv.z;
  }
`;
const particleFrag = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAlpha;
  varying float vLife;
  varying float vFlicker;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    float fade = smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.5, 1.0, vLife));
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.8, vLife));
    gl_FragColor = vec4(col * vFlicker, a * fade * vFlicker * uAlpha);
  }
`;

function makeParticles({ count, spread, height, colorA, colorB, speed, size, scale, alpha, drift, additive, pixelRatio, seed }) {
  const rand = rng(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * spread.x;
    pos[i * 3 + 1] = rand() * height;
    pos[i * 3 + 2] = (rand() - 0.5) * spread.z;
    seeds[i * 4] = rand();
    seeds[i * 4 + 1] = lerp(0.5, 1.4, rand());
    seeds[i * 4 + 2] = lerp(size[0], size[1], Math.pow(rand(), 2.2));
    seeds[i * 4 + 3] = lerp(drift[0], drift[1], rand());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: particleVert,
    fragmentShader: particleFrag,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uHeight: { value: height },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uAlpha: { value: alpha },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
    },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function makeShaft() {
  const geo = new THREE.CylinderGeometry(0.22, 1.35, 3.9, 40, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0xff9a50) }, uIntensity: { value: 0.16 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vRim;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vRim = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uTime;
      varying vec2 vUv;
      varying float vRim;
      void main() {
        float along = pow(vUv.y, 1.4) * smoothstep(0.0, 0.25, vUv.y);
        float soft = pow(vRim, 2.2);
        float flick = 0.88 + 0.12 * sin(uTime * 0.9 + vUv.y * 5.0);
        gl_FragColor = vec4(uColor, along * soft * uIntensity * flick);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

function makeSkyGlow() {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(260, 90),
    new THREE.ShaderMaterial({
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x0d0b0a) },
        uGlow: { value: new THREE.Color(0x6e3618) },
        uHorizon: { value: -3.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uGlow;
        uniform float uHorizon;
        varying vec3 vWorld;
        void main() {
          float band = exp(-pow((vWorld.y - uHorizon) / 11.0, 2.0));
          float side = exp(-pow((vWorld.x - 10.0) / 55.0, 2.0));
          gl_FragColor = vec4(mix(uTop, uGlow, band * (0.45 + 0.55 * side)), 1.0);
        }`,
    })
  );
}

function makeSkyline(rand) {
  // Agujas, torres y tejados lejanos: siluetas oscuras contra el resplandor
  const N = 46;
  const mat = new THREE.MeshBasicMaterial({ color: 0x070605 });
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, N);
  const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 1, 4, 1), mat, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));
  const qi = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let roofCount = 0;
  for (let i = 0; i < N; i++) {
    const x = lerp(-70, 70, (i + rand() * 0.8) / N);
    const z = lerp(-34, -24, rand());
    const w = lerp(1.6, 4.2, rand());
    const tall = rand() < 0.22;
    const h = tall ? lerp(12, 20, rand()) : lerp(4, 11, rand());
    const base = -12;
    p.set(x, base + h / 2, z);
    s.set(w, h, w * lerp(0.7, 1.2, rand()));
    m.compose(p, qi, s);
    towers.setMatrixAt(i, m);
    if (rand() < 0.75) {
      const rh = tall ? lerp(5, 9, rand()) : lerp(1.4, 4, rand());
      p.set(x, base + h + rh / 2, z);
      s.set(w * 1.05, rh, w * 1.05);
      m.compose(p, q, s);
      roofs.setMatrixAt(roofCount++, m);
    }
  }
  roofs.count = roofCount;
  const g = new THREE.Group();
  g.add(towers, roofs);
  return g;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const rand = rng(11);
  for (let i = 0; i < 28; i++) {
    const x = 20 + rand() * 88;
    const y = 36 + rand() * 56;
    const rad = 12 + rand() * 30;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.2)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- Carga opcional del .glb ---------- */
async function loadBellModel(url) {
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ]);
  const draco = new DRACOLoader().setDecoderPath(CONFIG.dracoDecoderPath);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  try {
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh && o.material) o.material.envMapIntensity = 0.9;
    });
    // Normaliza: misma altura que la campana procedural y colgando del origen
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.235 / (size.y || 1);
    model.scale.setScalar(k);
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.max.y, -center.z);
    const holder = new THREE.Group();
    holder.add(model);
    return holder;
  } finally {
    draco.dispose();
  }
}

/* ================================================================== */
export function initHeroScene(host, { reducedMotion = false, mobile = false } = {}) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : CONFIG.maxPixelRatio);
  const renderer = new THREE.WebGLRenderer({
    antialias: pixelRatio < 1.5,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(CONFIG.bg, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.bg);
  const FOG = 0.03;
  scene.fog = new THREE.FogExp2(CONFIG.bg, FOG);
  scene.environment = makeEnvironment(renderer);

  const CAM_Z = 14;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 0, CAM_Z);

  /* Luces */
  scene.add(new THREE.HemisphereLight(0x4a403a, 0x0d0b0a, 0.5));
  const rim = new THREE.DirectionalLight(0x9fb0c8, 1.3);
  rim.position.set(-6, 7, -8);
  const key = new THREE.DirectionalLight(0xffc79a, 0.9);
  key.position.set(4, 6, 7);
  scene.add(rim, key);

  /* Fondo: resplandor + skyline + niebla */
  const rand = rng(1987);
  const sky = makeSkyGlow();
  sky.position.z = -44;
  scene.add(sky, makeSkyline(rand));

  const cloudTex = cloudTexture();
  const fogCards = [];
  const cardCount = mobile ? 5 : 8;
  for (let i = 0; i < cardCount; i++) {
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({
        map: cloudTex,
        color: i % 3 === 0 ? 0x8a5a3e : 0x5c5048,
        transparent: true,
        opacity: lerp(0.35, 0.6, rand()),
        depthWrite: false,
      })
    );
    card.position.set(lerp(-14, 14, rand()), lerp(-5, 1.5, rand()), lerp(-16, 3, rand()));
    card.userData.speed = lerp(0.08, 0.22, rand()) * (rand() < 0.5 ? -1 : 1);
    card.userData.baseX = card.position.x;
    fogCards.push(card);
    scene.add(card);
  }

  /* Campanario + campana */
  const iron = new THREE.MeshStandardMaterial({ color: 0x3b3029, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.9, side: THREE.DoubleSide });
  const stone = new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0, roughness: 0.95, envMapIntensity: 0.25 });
  const rig = new THREE.Group();
  const swing = new THREE.Group();
  const bellHolder = new THREE.Group();
  const bell = buildBell(iron);
  bellHolder.add(bell);
  swing.add(bellHolder);
  rig.add(buildBelfry(stone, iron), swing);

  const shaft = makeShaft();
  shaft.position.set(0.15, -0.55, 0.1);
  shaft.rotation.z = -0.06;
  rig.add(shaft);

  const emberLight = new THREE.PointLight(CONFIG.ember, 14, 0, 2);
  emberLight.position.set(0.2, -2.6, 1.1);
  rig.add(emberLight);

  // Brasas que suben desde debajo de la campana (como de una forja)
  const rising = makeParticles({
    count: mobile ? 90 : 170, spread: { x: 2.6, z: 1.6 }, height: 4.5,
    colorA: 0xffc27a, colorB: 0xc8401a, speed: 0.55, size: [1.2, 3.6], scale: 34,
    alpha: 1, drift: [0.05, 0.35], additive: true, pixelRatio, seed: 3,
  });
  rising.position.set(0, -1.6, 0.4);
  rig.add(rising);
  scene.add(rig);

  // Brasas y polvo por toda la escena
  const embers = makeParticles({
    count: mobile ? 280 : 720, spread: { x: 34, z: 14 }, height: 20,
    colorA: 0xffb36a, colorB: 0xa8321a, speed: 0.7, size: [1.4, 4.4], scale: 38,
    alpha: 0.95, drift: [0.15, 0.8], additive: true, pixelRatio, seed: 21,
  });
  const dust = makeParticles({
    count: mobile ? 220 : 480, spread: { x: 30, z: 12 }, height: 18,
    colorA: 0xb8a998, colorB: 0x6d6258, speed: 0.12, size: [0.8, 2.2], scale: 26,
    alpha: 0.28, drift: [0.2, 0.9], additive: false, pixelRatio, seed: 77,
  });
  scene.add(embers, dust);

  /* GLB opcional */
  if (CONFIG.bellModel) {
    loadBellModel(CONFIG.bellModel)
      .then((model) => {
        bellHolder.clear();
        bellHolder.add(model);
        if (reducedMotion) renderer.render(scene, camera);
      })
      .catch((err) => console.warn('[hero] No se pudo cargar el .glb, se usa la campana procedural:', err));
  }

  /* Composicion responsive: la campana se coloca en coordenadas de pantalla */
  let heroHeight = host.clientHeight || window.innerHeight;
  function layout() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    heroHeight = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    const halfW = halfH * camera.aspect;
    // ndcX/ndcY: punto de cuelgue en pantalla (-1..1). size: alto de campana / alto de pantalla
    const portrait = camera.aspect < 0.95;
    const t = portrait ? { ndcX: 0.6, ndcY: 0.74, size: 0.13 } : { ndcX: 0.42, ndcY: 0.8, size: 0.22 };
    rig.position.set(t.ndcX * halfW, t.ndcY * halfH, 0);
    rig.scale.setScalar((t.size * 2 * halfH) / 1.235);
    sky.material.uniforms.uHorizon.value = portrait ? 0 : -3;
  }
  layout();

  /* Entrada del usuario */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!reducedMotion && matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  /* Bucle */
  const clock = new THREE.Clock();
  const particleSets = [embers, dust, rising];
  let scroll = 0;

  function frame() {
    const t = clock.getElapsedTime();
    // Progreso del scroll dentro del hero (lectura barata, sin listener de scroll)
    scroll = lerp(scroll, clamp01(window.scrollY / heroHeight), 0.12);
    pointer.x = lerp(pointer.x, pointer.tx, 0.045);
    pointer.y = lerp(pointer.y, pointer.ty, 0.045);

    camera.position.x = pointer.x * 0.7;
    camera.position.y = -pointer.y * 0.4 - scroll * 2.6;
    camera.position.z = CAM_Z + scroll * 2.5;
    camera.lookAt(pointer.x * 0.2, -scroll * 1.4, 0);
    scene.fog.density = FOG + scroll * 0.035;

    const amp = 0.04 + scroll * 0.12;
    swing.rotation.z = Math.sin(t * 0.55) * amp + Math.sin(t * 0.21) * 0.012;
    const clapper = bell.userData.clapper;
    if (clapper) clapper.rotation.z = Math.sin(t * 0.55 - 0.7) * amp * 1.8;
    rig.rotation.y = pointer.x * 0.18;

    emberLight.intensity = 14 * (0.82 + 0.1 * Math.sin(t * 3.1) + 0.08 * Math.sin(t * 7.3 + 1.2));
    shaft.material.uniforms.uTime.value = t;
    particleSets.forEach((p) => { p.material.uniforms.uTime.value = t; });
    embers.material.uniforms.uSpeed.value = 0.7 + scroll * 0.9;

    for (const c of fogCards) {
      c.position.x = c.userData.baseX + Math.sin(t * c.userData.speed) * 3.5;
    }
    renderer.render(scene, camera);
  }

  let running = false;
  let inView = true;
  const update = () => {
    const should = !reducedMotion && inView && !document.hidden;
    if (should === running) return;
    running = should;
    renderer.setAnimationLoop(should ? frame : null);
  };

  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; update(); }, { threshold: 0 });
  io.observe(host);
  document.addEventListener('visibilitychange', update);

  const ro = new ResizeObserver(() => {
    layout();
    if (!running) frame();
  });
  ro.observe(host);

  // Primer fotograma y fundido de entrada del canvas
  frame();
  requestAnimationFrame(() => host.classList.add('is-ready'));
  update();

  return function dispose() {
    renderer.setAnimationLoop(null);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('pointermove', onPointer);
    scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    scene.environment?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
