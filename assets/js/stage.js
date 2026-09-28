/* ==========================================================================
   Palco 3D do hero — Gustavo sobre a plataforma de mármore.
   A foto recortada vira uma malha em relevo (mapa de profundidade gerado por
   IA + volume da silhueta) e gira em vai-e-vem sobre a foto da plataforma.
   Parado de frente, a imagem é exatamente a foto; ao girar, o relevo e a luz
   mudam como num objeto 3D.
   ========================================================================== */
import * as THREE from 'three';

const BACKDROP = { w: 1176, h: 1524 };        // stage.webp
const FEET = { x: 588, y: 884 };              // ponto dos pés no tampo de mármore (px)
const FIG_PX = 770;                           // altura da figura na foto do palco (px)
const DEPTH_M = 0.2;                          // profundidade máxima codificada no PNG (m)
const RELIEF = 1.35;                          // exagero do relevo
const SWING = 0.45;                           // amplitude do vai-e-vem (rad ≈ 26°)

const VERT = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  uniform mat3 uRestRot;
  varying vec2 vUv;
  varying vec3 vView;
  varying vec3 vRest;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += texture2D(uDepth, uv).r * uDepthScale;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = mv.xyz;
    vRest = uRestRot * p;          // mesma geometria, sem a rotação (para a luz relativa)
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uLight;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vView;
  varying vec3 vRest;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.03) discard;
    vec3 L = normalize(vec3(0.55, 0.35, 1.0));
    vec3 nNow = normalize(cross(dFdx(vView), dFdy(vView)));
    vec3 nRest = normalize(cross(dFdx(vRest), dFdy(vRest)));
    // luz relativa: de frente (repouso) a foto fica intacta
    float shade = 1.0 + uLight * (max(dot(nNow, L), 0.0) - max(dot(nRest, L), 0.0));
    gl_FragColor = vec4(c.rgb * clamp(shade, 0.72, 1.18), c.a * uOpacity);
    #include <colorspace_fragment>
  }
`;

const loadTex = (loader, url, srgb) => new Promise((resolve, reject) => {
  loader.load(url, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    resolve(t);
  }, undefined, reject);
});

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = url;
});

export async function mountStage(container, { base = 'assets/img/hero/' } = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10, 10);
  camera.position.z = 5;

  const loader = new THREE.TextureLoader();
  const [bgTex, figTex, depthImg] = await Promise.all([
    loadTex(loader, `${base}stage.webp`, true),
    loadTex(loader, `${base}figure.webp`, true),
    loadImage(`${base}figure-depth.png`),
  ]);

  /* ---------- Fundo: foto da plataforma (unidade = altura da foto) ---------- */
  const bgAspect = BACKDROP.w / BACKDROP.h;
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(bgAspect, 1),
    new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false }),
  );
  bg.position.z = -2;
  scene.add(bg);

  const px = (x, y) => new THREE.Vector2(x / BACKDROP.h - bgAspect / 2, 0.5 - y / BACKDROP.h);
  const feet = px(FEET.x, FEET.y);

  /* ---------- Figura em relevo ---------- */
  const figAspect = figTex.image.width / figTex.image.height;
  const figH = FIG_PX / BACKDROP.h;                     // altura em unidades de cena
  const figW = figH * figAspect;
  const unitsPerMeter = figH / 1.78;
  const depthTex = new THREE.Texture(depthImg);
  depthTex.needsUpdate = true;
  depthTex.minFilter = THREE.LinearFilter;
  depthTex.generateMipmaps = false;

  const geo = new THREE.PlaneGeometry(figW, figH, 140, 400);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: figTex },
      uDepth: { value: depthTex },
      uDepthScale: { value: DEPTH_M * unitsPerMeter * RELIEF },
      uRestRot: { value: new THREE.Matrix3() },
      uLight: { value: 0.75 },
      uOpacity: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: true,
  });
  const figure = new THREE.Mesh(geo, material);
  // o eixo de giro passa pelo centro do corpo (≈ metade da profundidade)
  const pivot = new THREE.Group();
  pivot.position.set(feet.x, feet.y, 0);
  figure.position.set(0, figH / 2 - figH * 0.012, -DEPTH_M * unitsPerMeter * RELIEF * 0.45);
  pivot.add(figure);
  scene.add(pivot);

  /* ---------- Sombra de contato no mármore ---------- */
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const g = shadowCanvas.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, 'rgba(40,28,14,0.55)');
  grd.addColorStop(0.5, 'rgba(40,28,14,0.22)');
  grd.addColorStop(1, 'rgba(40,28,14,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(figW * 1.25, figH * 0.07),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, toneMapped: false }),
  );
  shadow.position.set(feet.x, feet.y + figH * 0.004, -1);
  scene.add(shadow);

  /* ---------- Enquadramento tipo "object-fit: cover" ---------- */
  // aproxima na figura (como um retrato), mantendo o tampo de mármore no quadro
  const ZOOM = 1.45;
  const focus = feet.y + figH * 0.36;
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    let halfW;
    let halfH;
    if (aspect > bgAspect) { halfW = bgAspect / 2; halfH = halfW / aspect; } else { halfH = 0.5; halfW = halfH * aspect; }
    halfW /= ZOOM;
    halfH /= ZOOM;
    const cy = THREE.MathUtils.clamp(focus, -0.5 + halfH, 0.5 - halfH);
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = cy + halfH;
    camera.bottom = cy - halfH;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(container);

  /* ---------- Interação: arrastar para girar ---------- */
  let angle = 0;
  let target = null;          // ângulo pedido pelo arraste
  let dragging = false;
  let lastX = 0;
  let t = 0;
  let phase = 0;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    target = angle;
    el.setPointerCapture(e.pointerId);
    container.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    target = THREE.MathUtils.clamp(target + (e.clientX - lastX) * 0.008, -0.6, 0.6);
    lastX = e.clientX;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    container.classList.remove('is-dragging');
    // retoma o vai-e-vem a partir do ângulo atual, sem salto
    phase = Math.asin(THREE.MathUtils.clamp(angle / SWING, -1, 1)) - t * 0.55;
    target = null;
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  const update = (dt) => {
    t += dt;
    const want = target ?? (reduced ? 0 : Math.sin(t * 0.55 + phase) * SWING);
    angle += (want - angle) * Math.min(1, dt * (target === null ? 6 : 12));
    pivot.rotation.y = angle;
    material.uniforms.uOpacity.value = Math.min(1, material.uniforms.uOpacity.value + dt * 1.6);
    shadow.scale.x = 1 - Math.abs(Math.sin(angle)) * 0.25;
  };

  let visible = true;
  let paused = false;
  let running = false;
  const clock = new THREE.Clock();
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

  resize();
  if (reduced) {
    material.uniforms.uOpacity.value = 1;
    renderer.render(scene, camera);
  } else {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) loop(); }).observe(container);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
    loop();
  }
  container.classList.add('is-ready');

  return {
    toggle() { paused = !paused; if (!paused) loop(); return paused; },
    setAngle(a) { target = a; update(1); renderer.render(scene, camera); },
  };
}
