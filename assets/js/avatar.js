/* ==========================================================================
   Avatar 3D — Gustavo girando sobre uma plataforma elevatória (tesoura).
   Three.js puro. Se existir um modelo realista em data-model (.glb), ele
   substitui o avatar procedural automaticamente.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SKIN = 0x55301d;
const HAIR = 0x120c09;
const LIFT_MIN = 0.03;
const LIFT_MAX = 0.36;

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

/* Textura de sarja (jeans) gerada em canvas */
function denimTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#121214';
  g.fillRect(0, 0, 256, 256);
  for (let i = -256; i < 512; i += 3) {
    g.strokeStyle = `rgba(255,255,255,${0.018 + Math.random() * 0.03})`;
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.stroke();
  }
  for (let n = 0; n < 2200; n++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

/* Tampo da plataforma: anéis usinados + marcações */
function deckTexture(accent) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, '#2a2f38');
  grd.addColorStop(1, '#14171c');
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

/* ---------- Cabeça: esfera deformada em formato de crânio + nariz ---------- */
function headGeometry() {
  const geo = new THREE.SphereGeometry(0.1, 72, 56);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ny = v.y / 0.1;
    // mandíbula mais estreita, topo levemente mais largo
    const jaw = ny < 0 ? 1 - 0.3 * Math.pow(-ny, 1.4) : 1 + 0.02 * ny;
    v.x *= 0.86 * jaw;
    v.z *= 0.97 * (ny < 0 ? 1 - 0.08 * -ny : 1);
    v.y *= 1.13;
    if (v.z > 0) {
      // nariz
      const nose = Math.exp(-((v.x / 0.016) ** 2) - ((v.y + 0.012) / 0.028) ** 2);
      v.z += 0.011 * nose;
      // sobrancelha / órbita
      const brow = Math.exp(-(((v.y - 0.03) / 0.012) ** 2)) * Math.exp(-(((Math.abs(v.x) - 0.03) / 0.03) ** 2));
      v.z += 0.004 * brow;
      // queixo
      const chin = Math.exp(-((v.x / 0.03) ** 2) - ((v.y + 0.098) / 0.02) ** 2);
      v.z += 0.006 * chin;
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ---------- Cabelo cacheado: milhares de cachos instanciados ---------- */
function buildHair(headMesh) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.62, metalness: 0.02 });

  // "touca" que preenche o volume por baixo dos cachos
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 48, 32, 0, Math.PI * 2, 0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.9 }),
  );
  cap.scale.set(0.93, 1.16, 1.03);
  cap.position.set(0, 0.006, -0.004);
  cap.rotation.x = -0.6;
  group.add(cap);

  const curl = new THREE.TorusGeometry(0.0085, 0.0034, 4, 9);
  const count = 3000;
  const inst = new THREE.InstancedMesh(curl, mat, count);
  inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const color = new THREE.Color();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 20) {
    guard++;
    // ponto aleatório na esfera
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th));
    const front = dir.z > 0.25;
    // limites: linha do cabelo na testa, costeletas, nuca
    if (front && dir.y < 0.42 && Math.abs(dir.x) < 0.62) continue;
    if (dir.y < -0.05 && dir.z > -0.2) continue;
    if (dir.y < -0.55) continue;
    if (Math.abs(dir.x) > 0.8 && dir.y < 0.15 && dir.z > -0.4) continue; // orelhas
    // volume maior no topo (como na foto)
    const top = Math.max(0, dir.y);
    const lift = 0.006 + top * 0.034 + Math.random() * 0.02 + (front ? 0.008 : 0);
    pos.set(dir.x * 0.1 * 0.9, dir.y * 0.1 * 1.13 + 0.004, dir.z * 0.1 * 0.99);
    pos.addScaledVector(dir, lift);
    e.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    q.setFromEuler(e);
    const k = 0.75 + Math.random() * 0.7;
    s.set(k, k, k * (0.8 + Math.random() * 0.5));
    m.compose(pos, q, s);
    inst.setMatrixAt(placed, m);
    color.setHSL(0.06, 0.35, 0.03 + Math.random() * 0.06);
    inst.setColorAt(placed, color);
    placed++;
  }
  inst.count = placed;
  group.add(inst);

  // franja caindo sobre a testa
  const fringe = new THREE.InstancedMesh(curl, mat, 140);
  for (let i = 0; i < 140; i++) {
    const x = (Math.random() - 0.5) * 0.12;
    const y = 0.068 + Math.random() * 0.025;
    const z = 0.07 + Math.random() * 0.018 - Math.abs(x) * 0.35;
    e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    q.setFromEuler(e);
    const k = 0.7 + Math.random() * 0.5;
    m.compose(pos.set(x, y, z), q, s.set(k, k, k));
    fringe.setMatrixAt(i, m);
  }
  group.add(fringe);
  headMesh.add(group);
  return group;
}

/* ---------- Avatar procedural (≈ 1,78 m) ---------- */
async function buildAvatar(loader, base) {
  const avatar = new THREE.Group();
  avatar.name = 'avatar';

  const [shirtMap, faceMap] = await Promise.all([
    loadTexture(loader, `${base}shirt.webp`),
    loadTexture(loader, `${base}face.webp`),
  ]);

  const skin = new THREE.MeshPhysicalMaterial({
    color: SKIN, roughness: 0.52, sheen: 0.35, sheenColor: new THREE.Color(0xffb08a), sheenRoughness: 0.6,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.75 });
  const cuff = new THREE.MeshStandardMaterial({ color: 0x5a5a5e, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0xffffff, map: denimTexture(), roughness: 0.92 });
  const shoeMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f2, roughness: 0.42, clearcoat: 0.25 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: shirtMap, roughness: 0.72, side: THREE.DoubleSide });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 1, roughness: 0.22 });

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = avatar) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  /* Tênis brancos */
  for (const sx of [-1, 1]) {
    const shoe = add(new RoundedBoxGeometry(0.108, 0.075, 0.275, 5, 0.035), shoeMat, sx * 0.092, 0.052, 0.035);
    shoe.rotation.y = sx * 0.06;
    add(new RoundedBoxGeometry(0.114, 0.026, 0.282, 3, 0.012), soleMat, sx * 0.092, 0.014, 0.035).rotation.y = sx * 0.06;
    // cadarço
    const lace = add(new THREE.BoxGeometry(0.05, 0.004, 0.08), soleMat, sx * 0.092, 0.091, 0.07);
    lace.rotation.x = -0.35;
  }

  /* Calça jeans preta */
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.078, 0.06, 0.84, 32), pants, sx * 0.092, 0.5, 0);
    add(new THREE.CylinderGeometry(0.062, 0.066, 0.05, 32), pants, sx * 0.092, 0.1, 0.005); // barra
  }
  const hips = add(new THREE.CylinderGeometry(0.165, 0.172, 0.2, 40), pants, 0, 0.9, 0);
  hips.scale.z = 0.72;
  const seat = add(new THREE.SphereGeometry(0.16, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), pants, 0, 0.82, 0);
  seat.scale.set(1.05, 0.5, 0.72);

  /* Tronco com a camisa (torno) */
  const profile = [
    [0.196, 0.78], [0.2, 0.84], [0.196, 0.95], [0.19, 1.06], [0.196, 1.17],
    [0.21, 1.27], [0.222, 1.35], [0.222, 1.4], [0.2, 1.445], [0.14, 1.475], [0.075, 1.492], [0.06, 1.5],
  ].map(([r, y]) => new THREE.Vector3(r, y, 0));
  // reamostra por comprimento de arco: a estampa não fica esmagada nos ombros
  const spaced = new THREE.CatmullRomCurve3(profile, false, 'centripetal').getSpacedPoints(40)
    .map((v) => new THREE.Vector2(Math.max(0.001, v.x), v.y));
  const torso = add(new THREE.LatheGeometry(spaced, 96), shirtMat);
  torso.scale.z = 0.64;
  torso.name = 'torso';

  // barra da camisa (costura) e botões
  const hem = add(new THREE.TorusGeometry(0.196, 0.0035, 8, 96), shirtMat, 0, 0.782, 0);
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.64;
  for (const [y, r] of [[0.9, 0.198], [1.02, 0.192], [1.14, 0.194], [1.26, 0.208]]) {
    add(new THREE.SphereGeometry(0.0065, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 }), 0, y, r * 0.64 + 0.002);
  }

  // gola
  const collar = add(new THREE.TorusGeometry(0.068, 0.017, 16, 48), black, 0, 1.49, -0.004);
  collar.rotation.x = Math.PI / 2 - 0.25;
  collar.scale.set(1.05, 0.92, 1);
  for (const sx of [-1, 1]) {
    const lapel = add(new THREE.BoxGeometry(0.06, 0.1, 0.006), black, sx * 0.04, 1.44, 0.118);
    lapel.rotation.set(-0.35, sx * 0.25, sx * 0.55);
  }
  // abertura em V com a pele e a corrente
  const chest = add(new THREE.CircleGeometry(0.035, 3), skin, 0, 1.455, 0.122);
  chest.rotation.set(-0.3, 0, Math.PI / 2 + Math.PI / 6);
  chest.scale.set(1.3, 0.9, 1);

  /* Braços (pose relaxada) */
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.215, 1.405, 0);
    shoulder.rotation.z = sx * 0.13;
    avatar.add(shoulder);

    const sleeve = add(new THREE.CylinderGeometry(0.074, 0.07, 0.2, 32), black, 0, -0.08, 0, shoulder);
    sleeve.scale.z = 0.92;
    const shoulderCap = add(new THREE.SphereGeometry(0.074, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), black, 0, 0.02, 0, shoulder);
    shoulderCap.scale.z = 0.92;
    const cuffRing = add(new THREE.TorusGeometry(0.068, 0.012, 10, 32), cuff, 0, -0.18, 0, shoulder);
    cuffRing.rotation.x = Math.PI / 2;

    add(new THREE.CapsuleGeometry(0.041, 0.2, 8, 20), skin, 0, -0.24, 0, shoulder);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.33, 0);
    elbow.rotation.x = -0.14;
    shoulder.add(elbow);
    add(new THREE.SphereGeometry(0.038, 20, 14), skin, 0, 0, 0, elbow);
    add(new THREE.CapsuleGeometry(0.035, 0.22, 8, 20), skin, 0, -0.13, 0, elbow);
    const hand = add(new THREE.SphereGeometry(0.045, 24, 16), skin, 0, -0.3, 0.004, elbow);
    hand.scale.set(0.62, 1.55, 1);
    const thumb = add(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), skin, sx * -0.012, -0.285, 0.03, elbow);
    thumb.rotation.x = 0.4;
    arms.push({ shoulder, elbow, sx });
  }

  /* Pescoço e corrente */
  add(new THREE.CylinderGeometry(0.054, 0.06, 0.1, 32), skin, 0, 1.525, 0.004);
  const chain = add(new THREE.TorusGeometry(0.062, 0.0018, 8, 80), silver, 0, 1.495, 0.022);
  chain.rotation.x = Math.PI / 2 - 0.62;
  chain.scale.set(1.02, 1.2, 1);

  /* Cabeça */
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.655, 0.014);
  avatar.add(headPivot);
  const head = add(headGeometry(), skin, 0, 0, 0, headPivot);
  head.name = 'head';

  // orelhas
  for (const sx of [-1, 1]) {
    const ear = add(new THREE.SphereGeometry(0.03, 20, 14), skin, sx * 0.083, -0.004, -0.008, headPivot);
    ear.scale.set(0.35, 0.95, 0.6);
    ear.rotation.y = sx * 0.3;
  }

  // rosto: foto projetada (decal) sobre a frente da cabeça
  if (faceMap) {
    head.updateMatrixWorld(true);
    const decalGeo = new DecalGeometry(
      head,
      new THREE.Vector3(0, -0.028, 0.1).applyMatrix4(head.matrixWorld),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0.168, 0.2, 0.16),
    );
    // DecalGeometry trabalha em coordenadas de mundo: volta para o espaço local da cabeça
    decalGeo.applyMatrix4(new THREE.Matrix4().copy(head.matrixWorld).invert());
    const decal = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({
      map: faceMap, transparent: true, roughness: 0.55, depthWrite: false,
      emissive: 0xffffff, emissiveMap: faceMap, emissiveIntensity: 0.16,
      polygonOffset: true, polygonOffsetFactor: -4, color: new THREE.Color(1.02, 0.98, 0.95),
    }));
    decal.renderOrder = 2;
    head.add(decal);
  }

  buildHair(head);

  return { avatar, arms, headPivot, torso };
}

/* ---------- Plataforma elevatória (mecanismo de tesoura) ---------- */
function buildPlatform(accentHex) {
  const accent = new THREE.Color(accentHex);
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1c2027, metalness: 0.85, roughness: 0.32 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.95, roughness: 0.28 });
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

/* ========================================================================== */
export async function mountAvatar(container, options = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = options.textures || 'assets/img/avatar/';
  const readAccent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c8f135';
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
  const rimB = new THREE.SpotLight(0xb8c4ff, 4, 8, 0.6, 0.6);
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
  const built = await buildAvatar(loader, base);
  const turntable = new THREE.Group();
  turntable.add(built.avatar);
  platform.top.add(turntable);

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
        turntable.remove(built.avatar);
        turntable.add(model);
        built.custom = true;
        container.dataset.model = 'loaded';
      }, undefined, () => { /* sem modelo: segue com o procedural */ });
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

    if (!built.custom) {
      // respiração e balanço sutil
      const br = Math.sin(t * 1.9);
      built.torso.scale.x = 1 + br * 0.006;
      built.torso.scale.z = 0.64 * (1 + br * 0.012);
      built.headPivot.rotation.x = Math.sin(t * 0.7) * 0.03;
      built.headPivot.rotation.z = Math.sin(t * 0.5) * 0.02;
      for (const a of built.arms) {
        a.shoulder.rotation.z = a.sx * (0.13 + br * 0.008);
        a.shoulder.rotation.x = Math.sin(t * 0.9 + a.sx) * 0.03;
      }
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
