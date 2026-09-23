/* ==========================================================================
   Avatar 3D — personagem girando sobre uma plataforma elevatória (tesoura).
   O personagem é um "photo turntable": fotos reais de frente, lado e costas,
   recortadas, que se misturam conforme o ângulo da plataforma. Se existir um
   modelo 3D (.glb) em data-model, ele substitui as fotos automaticamente.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const LIFT_MIN = 0.03;
const LIFT_MAX = 0.36;
const FIG_HEIGHT = 1.78; // altura do personagem em metros

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function loadTexture(loader, url, srgb = true) {
  return new Promise((resolve) => {
    loader.load(url, (tex) => {
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      resolve(tex);
    }, undefined, () => resolve(null));
  });
}


/* Tampo da plataforma: anéis usinados + marcações */
function deckTexture(accent) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, '#1f1c16');
  grd.addColorStop(1, '#0a0907');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  for (let r = 30; r < 256; r += 7) {
    g.strokeStyle = `rgba(255,255,255,${0.025 + (r % 21 === 2 ? 0.04 : 0)})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = accent;
  g.globalAlpha = 0.55;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(256, 256, 236, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.8;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r0 = i % 4 === 0 ? 212 : 222;
    g.beginPath();
    g.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    g.lineTo(256 + Math.cos(a) * 230, 256 + Math.sin(a) * 230);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}


/* ---------- Personagem: fotos reais misturadas pelo ângulo ---------- */
const VIEW_VERT = /* glsl */ `
  uniform float uSquash;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.x *= uSquash;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const VIEW_FRAG = /* glsl */ `
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform float uMix;
  uniform float uOpacity;
  uniform float uShade;
  varying vec2 vUv;
  void main() {
    vec4 a = texture2D(uA, vUv);
    vec4 b = texture2D(uB, vUv);
    // dissolve pré-multiplicado: sem "fantasma" transparente no meio da troca
    vec3 rgb = a.rgb * a.a * (1.0 - uMix) + b.rgb * b.a * uMix;
    float alpha = a.a * (1.0 - uMix) + b.a * uMix;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(rgb / alpha * uShade, alpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

async function buildPhotoFigure(loader, base) {
  const textures = await Promise.all([0, 1, 2, 3].map((i) => loadTexture(loader, `${base}view-${i}.webp`)));
  if (textures.some((t) => !t)) return null;
  const img = textures[0].image;
  const aspect = img.width / img.height;
  // as imagens têm 12 px de margem sob os pés e a figura ocupa 1370 de 1400 px
  const h = FIG_HEIGHT * (img.height / 1370);
  const w = h * aspect;
  const foot = (12 / img.height) * h;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: textures[0] },
      uB: { value: textures[1] },
      uMix: { value: 0 },
      uSquash: { value: 1 },
      uOpacity: { value: 1 },
      uShade: { value: 1 },
    },
    vertexShader: VIEW_VERT,
    fragmentShader: VIEW_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.y = h / 2 - foot;
  mesh.renderOrder = 3;

  // sombra de contato sob os pés
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.34),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = 2;

  const group = new THREE.Group();
  group.add(shadow, mesh);

  const smooth = (e0, e1, x) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
  };

  /* ângulo (rad) → par de fotos + mistura. 0 frente, 90° lado direito, 180° costas, 270° lado esquerdo */
  const setAngle = (angle) => {
    const u = ((angle / (Math.PI / 2)) % 4 + 4) % 4;
    const i = Math.floor(u);
    const f = u - i;
    material.uniforms.uA.value = textures[i];
    material.uniforms.uB.value = textures[(i + 1) % 4];
    material.uniforms.uMix.value = smooth(0.38, 0.62, f);
    // leve estreitamento no meio da troca, como um corpo girando
    const s = Math.sin(Math.PI * f);
    material.uniforms.uSquash.value = 1 - 0.1 * s * s;
    material.uniforms.uShade.value = 1 - 0.1 * s * s;
  };
  setAngle(0);

  return { group, setAngle, material };
}

/* ---------- Plataforma elevatória (mecanismo de tesoura) ---------- */
function buildPlatform(accentHex) {
  const accent = new THREE.Color(accentHex);
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x15130f, metalness: 0.85, roughness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9a67a, metalness: 0.95, roughness: 0.28 });
  const glow = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
  const hazard = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#111';
    g.fillRect(0, 0, 256, 16);
    g.fillStyle = '#e8b21c';
    for (let x = -16; x < 256; x += 16) {
      g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, 16); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(6, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2 });
  })();

  const mesh = (geo, mat, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // base fixa no chão
  const base = mesh(new THREE.CylinderGeometry(0.74, 0.78, 0.05, 96), metal);
  base.position.y = 0.025;
  const baseRing = mesh(new THREE.CylinderGeometry(0.781, 0.781, 0.016, 96, 1, true), hazard);
  baseRing.position.y = 0.03;

  // tesouras (duas laterais)
  const scissors = [];
  const L = 0.78;
  for (const z of [-0.26, 0.26]) {
    const pair = new THREE.Group();
    pair.position.z = z;
    group.add(pair);
    const a = mesh(new THREE.BoxGeometry(L, 0.034, 0.026), steel, pair);
    const b = mesh(new THREE.BoxGeometry(L, 0.034, 0.026), steel, pair);
    b.position.z = 0.03;
    const pin = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 16), metal, pair);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = 0.015;
    scissors.push({ pair, a, b, pin });
  }
  // eixos transversais
  const axles = [];
  for (let i = 0; i < 4; i++) {
    const ax = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 12), steel);
    ax.rotation.x = Math.PI / 2;
    axles.push(ax);
  }
  // cilindro hidráulico
  const cylBody = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 20), metal);
  const cylRod = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 16), steel);

  // tampo giratório
  const top = new THREE.Group();
  group.add(top);
  const deckBody = mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.07, 96), metal, top);
  deckBody.position.y = -0.035;
  const deck = mesh(new THREE.CircleGeometry(0.66, 96), new THREE.MeshStandardMaterial({
    map: deckTexture(`#${accent.getHexString()}`), metalness: 0.7, roughness: 0.38,
  }), top);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.0005;
  const edge = mesh(new THREE.TorusGeometry(0.672, 0.007, 12, 160), glow, top);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = -0.012;
  edge.castShadow = false;
  const under = mesh(new THREE.TorusGeometry(0.62, 0.004, 8, 120), glow, top);
  under.rotation.x = Math.PI / 2;
  under.position.y = -0.072;
  under.castShadow = false;

  const setLift = (h) => {
    // h: altura entre base e tampo
    const theta = Math.asin(Math.min(0.98, h / L));
    const cx = 0;
    const cy = 0.05 + h / 2;
    for (const s of scissors) {
      s.a.position.set(cx, cy, 0);
      s.a.rotation.z = theta;
      s.b.position.set(cx, cy, 0.03);
      s.b.rotation.z = -theta;
      s.pin.position.set(cx, cy, 0.015);
    }
    const half = (Math.cos(theta) * L) / 2;
    axles[0].position.set(-half, 0.05, 0);
    axles[1].position.set(half, 0.05, 0);
    axles[2].position.set(-half, 0.05 + h, 0);
    axles[3].position.set(half, 0.05 + h, 0);
    cylBody.position.set(0, 0.13, 0);
    cylRod.position.set(0, 0.05 + Math.max(0.2, h * 0.75), 0);
    cylRod.scale.y = Math.max(0.35, h / 0.3);
    top.position.y = 0.05 + h + 0.07;
  };

  return { group, top, setLift, glow };
}

/* ---------- Setas circulares (como no esboço) ---------- */
function buildOrbitArrows(color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false });
  const make = (radius, tube, arc) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 128, arc), mat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const head = new THREE.Mesh(new THREE.ConeGeometry(tube * 4.2, tube * 11, 16), mat);
    // ponta da seta no final do arco, tangente ao círculo
    head.position.set(Math.cos(arc) * radius, 0, -Math.sin(arc) * radius);
    head.rotation.set(0, arc, 0);
    head.rotateX(-Math.PI / 2);
    g.add(head);
    return g;
  };
  const headArrows = new THREE.Group();
  const headSpin = new THREE.Group();
  const a1 = make(0.26, 0.005, Math.PI * 0.8);
  const a2 = make(0.26, 0.005, Math.PI * 0.8);
  a2.rotation.y = Math.PI;
  headSpin.add(a1, a2);
  headArrows.add(headSpin);
  headArrows.rotation.x = 0.42;
  const baseArrows = new THREE.Group();
  const b1 = make(0.9, 0.006, Math.PI * 0.85);
  const b2 = make(0.9, 0.006, Math.PI * 0.85);
  b2.rotation.y = Math.PI;
  baseArrows.add(b1, b2);
  return { headArrows, headSpin, baseArrows, mat };
}

/* ---------- Partículas subindo do anel ---------- */
function buildSparks(color) {
  const n = 140;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.62 + Math.random() * 0.12;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 1.2;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.018, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
  const pts = new THREE.Points(geo, mat);
  return { pts, seed, mat };
}


export async function mountAvatar(container, options = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = options.textures || 'assets/img/avatar/';
  const readAccent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d4af37';
  let accent = readAccent();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 1.22, 0);

  // luzes de estúdio
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1410, 0.5));
  const key = new THREE.DirectionalLight(0xfff3e6, 2.6);
  key.position.set(2.2, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.4;
  key.shadow.camera.right = 1.4;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -0.4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7);
  fill.position.set(-3, 2, 2);
  scene.add(fill);
  const rimA = new THREE.SpotLight(accent, 7, 8, 0.6, 0.6);
  rimA.position.set(-2, 3, -2.4);
  rimA.target.position.set(0, 1.2, 0);
  scene.add(rimA, rimA.target);
  const rimB = new THREE.SpotLight(0xfff1cc, 4, 8, 0.6, 0.6);
  rimB.position.set(2.4, 2.4, -2.2);
  rimB.target.position.set(0, 1.1, 0);
  scene.add(rimB, rimB.target);

  // sombra de contato suave sob a plataforma
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)');
    grd.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.001;
  scene.add(contact);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.5, 96),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.08, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.002;
  scene.add(halo);

  const platform = buildPlatform(accent);
  scene.add(platform.group);

  const arrows = buildOrbitArrows(accent);
  scene.add(arrows.baseArrows);
  scene.add(arrows.headArrows);

  const sparks = buildSparks(accent);
  scene.add(sparks.pts);

  const loader = new THREE.TextureLoader();
  const figure = await buildPhotoFigure(loader, base);
  if (!figure && !options.model) throw new Error('avatar: imagens não encontradas');
  // a figura fica de frente para a câmera; o ângulo da plataforma escolhe a foto
  const figureHolder = new THREE.Group();
  if (figure) figureHolder.add(figure.group);
  scene.add(figureHolder);
  const turntable = new THREE.Group();
  platform.top.add(turntable);
  const state = { custom: false };

  // modelo realista opcional (.glb) — substitui o procedural
  if (options.model) {
    import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      new GLTFLoader().load(options.model, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.78 / size.y;
        model.scale.setScalar(scale);
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -box.min.y, -center.z);
        model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.remove(figureHolder);
        turntable.add(model);
        state.custom = true;
        container.dataset.model = 'loaded';
      }, undefined, () => { /* sem modelo: segue com as fotos */ });
    });
  }

  /* ---------- Interação: arrastar para girar ---------- */
  let spin = 0;
  let velocity = 0;
  const autoSpeed = 0.5;
  let dragging = false;
  let lastX = 0;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    el.setPointerCapture(e.pointerId);
    container.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    spin += dx * 0.012;
    velocity = dx * 0.6;
  });
  const release = () => { dragging = false; container.classList.remove('is-dragging'); };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  let paused = false;
  const api = {
    toggle() { paused = !paused; if (!paused) loop(); return paused; },
    get paused() { return paused; },
    camera,
    render: () => renderer.render(scene, camera),
  };

  /* ---------- Tamanho ---------- */
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // enquadra ~2,5 m de altura (ou largura, em telas estreitas)
    const fitH = 2.45;
    const fitW = 2.05;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = fitH / 2 / Math.tan(vFov / 2);
    const distW = fitW / 2 / Math.tan(vFov / 2) / camera.aspect;
    const dist = Math.max(distH, distW);
    camera.position.set(0, target.y + dist * 0.12, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (reduced || paused) renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const onAccent = () => {
    accent = readAccent();
    const c = new THREE.Color(accent);
    platform.glow.color.copy(c);
    arrows.mat.color.copy(c);
    sparks.mat.color.copy(c);
    halo.material.color.copy(c);
    rimA.color.copy(c);
    if (reduced || paused) renderer.render(scene, camera);
  };
  window.addEventListener('themechange', onAccent);

  /* ---------- Animação ---------- */
  const clock = new THREE.Clock();
  let t = 0;
  const intro = 2.6;
  let visible = true;
  let running = false;

  const update = (dt) => {
    t += dt;
    const k = reduced ? 1 : easeInOut(Math.min(t / intro, 1));
    platform.setLift(LIFT_MIN + (LIFT_MAX - LIFT_MIN) * k);

    if (!dragging) {
      velocity *= 0.94;
      spin += (autoSpeed * (reduced ? 0 : 1) + velocity) * dt;
    }
    platform.top.rotation.y = spin;
    arrows.baseArrows.rotation.y = spin * 0.6;
    arrows.headSpin.rotation.y = t * 0.9;

    if (figure && !state.custom) {
      figure.setAngle(spin);
      figureHolder.position.y = platform.top.position.y;
    }

    // faíscas subindo
    const p = sparks.pts.geometry.attributes.position;
    const baseY = platform.top.position.y;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.12 + sparks.seed[i] * 0.25);
      if (y > 1.4) y = 0;
      p.setY(i, y);
    }
    p.needsUpdate = true;
    sparks.pts.position.y = baseY - 0.05;
    arrows.headArrows.position.y = baseY + 1.9;
    arrows.baseArrows.position.y = baseY - 0.02;
    sparks.mat.opacity = 0.55 * k;
    arrows.mat.opacity = 0.9 * k;
    halo.material.opacity = 0.06 + 0.04 * Math.sin(t * 2);
  };

  function loop() {
    if (running) return;
    running = true;
    clock.getDelta();
    const frame = () => {
      if (!visible || paused || document.hidden) { running = false; return; }
      update(Math.min(clock.getDelta(), 0.05));
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  if (reduced) {
    update(intro);
    renderer.render(scene, camera);
  } else {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) loop();
    }).observe(container);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
    loop();
  }

  container.classList.add('is-ready');
  return api;
}
