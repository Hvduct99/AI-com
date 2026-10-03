// ============================================================
// AssetLoader — ĐIỂM THAY ASSET DUY NHẤT.
// Gọi preloadAssets() 1 lần trước khi tạo Game. Nếu tải lỗi,
// mọi builder tự fallback về mesh procedural (game vẫn chạy).
//   AssetBuilders.CharacterBuilder = (def) => Group;
//   AssetBuilders.ProjectileBuilder = (skill, element) => Group;
//   AssetBuilders.ArenaBuilder = (width) => { floor, wallL, wallR, ... };
//
// Asset (CC0):
//   models/RobotExpressive.glb — Tomás Laulhé (quaternius), Don McCurdy
//   textures/floor_*.jpg        — Poly Haven "Stone Tiles"
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ELEMENTS } from '../config/elements.js';

const BASE = import.meta.env.BASE_URL;
const FIGHTER_HEIGHT = 3.3;

const loaded = {
  robot: null,       // { scene, clips, scale }
  floorDiff: null,
  floorNor: null,
};

function loadTexture(loader, url, srgb) {
  return new Promise((resolve) => {
    loader.load(url, (tex) => {
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      resolve(tex);
    }, undefined, () => {
      console.warn('[assets] Không tải được', url);
      resolve(null);
    });
  });
}

function loadRobot() {
  return new Promise((resolve) => {
    new GLTFLoader().load(`${BASE}models/RobotExpressive.glb`, (gltf) => {
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      const h = box.max.y - box.min.y;
      const scale = Number.isFinite(h) && h > 0.1 ? FIGHTER_HEIGHT / h : 0.7;
      resolve({ scene, clips: gltf.animations, scale });
    }, undefined, (err) => {
      console.warn('[assets] Không tải được model, dùng mesh procedural.', err);
      resolve(null);
    });
  });
}

let preloadPromise = null;
/** Tải toàn bộ asset. Không bao giờ reject. */
export function preloadAssets(onProgress) {
  if (preloadPromise) return preloadPromise;
  const tl = new THREE.TextureLoader();
  let done = 0;
  const tasks = [
    loadRobot().then((r) => { loaded.robot = r; }),
    loadTexture(tl, `${BASE}textures/floor_diff.jpg`, true).then((t) => { loaded.floorDiff = t; }),
    loadTexture(tl, `${BASE}textures/floor_nor.jpg`, false).then((t) => { loaded.floorNor = t; }),
  ].map((p) => p.then(() => onProgress?.(++done / tasks.length)));
  preloadPromise = Promise.all(tasks).then(() => undefined);
  return preloadPromise;
}

// ------------------------------------------------------------
// Nhân vật
// ------------------------------------------------------------
function addFootDisc(g, color) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  g.add(disc);
  const discRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  discRing.rotation.x = -Math.PI / 2;
  discRing.position.y = 0.03;
  g.add(discRing);
}

function buildRobotFighter(def) {
  const el = ELEMENTS[def.element];
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(loaded.robot.scene);
  model.scale.setScalar(loaded.robot.scale);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.sharedGeo = true;
    o.castShadow = true;
    o.frustumCulled = false; // skinned mesh hay bị cull sai khi chạy animation
    o.material = o.material.clone();
    const m = o.material;
    if (m.name === 'Main') {
      m.color.setHex(el.color);
      m.metalness = def.element === 'kim' ? 0.7 : 0.25;
      m.roughness = def.element === 'kim' ? 0.3 : 0.5;
    }
    if (m.emissive) {
      m.emissive.setHex(el.color);
      m.emissiveIntensity = m.name === 'Main' ? 0.18 : 0.06;
    }
  });
  root.add(model);
  addFootDisc(root, el.color);
  root.userData.animRoot = model;
  root.userData.clips = loaded.robot.clips;
  root.userData.height = FIGHTER_HEIGHT;
  // Quay xéo về phía camera cho dễ nhìn (mô hình gốc nhìn +Z)
  root.userData.yawRight = Math.PI / 2 - 0.45;
  root.userData.yawLeft = -Math.PI / 2 + 0.45;
  return root;
}

function buildProceduralFighter(def) {
  const el = ELEMENTS[def.element];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: el.color, roughness: 0.35, metalness: 0.2,
    emissive: el.color, emissiveIntensity: 0.3,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3f, roughness: 0.5, emissive: el.color, emissiveIntensity: 0.15,
  });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 6, 14), bodyMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  body.add(torso);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  chest.position.set(0, 1.55, 0.5);
  body.add(chest);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.09, 8, 24), darkMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.1;
  body.add(belt);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe8c9, roughness: 0.4, emissive: el.color, emissiveIntensity: 0.1 })
  );
  head.position.y = 2.55;
  head.castShadow = true;
  body.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-0.15, 0.15]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
    eye.position.set(sx, 2.6, 0.34);
    body.add(eye);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.08, 10, 32), new THREE.MeshBasicMaterial({ color: el.color }));
  ring.position.y = 3.1;
  ring.rotation.x = Math.PI / 2.4;
  body.add(ring);

  const armGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.72, 1.6, 0);
  armL.rotation.z = 0.25;
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.72, 1.6, 0);
  armR.rotation.z = -0.25;
  body.add(armL, armR);

  body.scale.setScalar(1.25);
  addFootDisc(g, el.color);
  g.userData.ring = ring;
  g.userData.armR = armR;
  g.userData.height = 3.9;
  g.userData.yawRight = 0.5;
  g.userData.yawLeft = -0.5;
  return g;
}

function buildFighter(def) {
  return loaded.robot ? buildRobotFighter(def) : buildProceduralFighter(def);
}

// ------------------------------------------------------------
// Đạn skill — geometry/material dùng chung, KHÔNG tạo đèn mới
// (thêm/bớt đèn làm three.js biên dịch lại shader => giật).
// ------------------------------------------------------------
const projCache = new Map();
function projectileParts(skill) {
  const key = `${skill.element}:${skill.index}`;
  if (projCache.has(key)) return projCache.get(key);
  const color = ELEMENTS[skill.element]?.color ?? 0xffffff;
  const s = skill.size;
  let coreGeo;
  switch (skill.element) {
    case 'kim': coreGeo = new THREE.OctahedronGeometry(s * 1.1, 0); break;
    case 'moc': coreGeo = new THREE.TetrahedronGeometry(s * 1.15, 1); break;
    case 'tho': coreGeo = new THREE.DodecahedronGeometry(s, 0); break;
    case 'hoa': coreGeo = new THREE.IcosahedronGeometry(s, 1); break;
    default: coreGeo = new THREE.SphereGeometry(s, 18, 14);
  }
  const parts = {
    coreGeo,
    coreMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35) }),
    glowGeo: new THREE.SphereGeometry(s * 1.7, 16, 12),
    glowMat: new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    haloGeo: skill.isUltimate ? new THREE.TorusGeometry(s * 2.1, s * 0.18, 8, 32) : null,
    haloMat: skill.isUltimate
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })
      : null,
  };
  projCache.set(key, parts);
  return parts;
}

function buildProjectileMesh(skill) {
  const parts = projectileParts(skill);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(parts.coreGeo, parts.coreMat));
  group.add(new THREE.Mesh(parts.glowGeo, parts.glowMat));
  if (parts.haloGeo) {
    const halo = new THREE.Mesh(parts.haloGeo, parts.haloMat);
    halo.userData.isHalo = true;
    group.add(halo);
    group.userData.halo = halo;
  }
  return group;
}

// ------------------------------------------------------------
// Sàn đấu + phông nền
// ------------------------------------------------------------
function makeEmblemTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256, cy = 256, R = 200;
  ctx.strokeStyle = 'rgba(255,215,0,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, R + 30, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R + 44, 0, Math.PI * 2); ctx.stroke();
  // Vòng tương sinh (ngũ giác) + tương khắc (ngôi sao)
  const order = ['moc', 'hoa', 'tho', 'kim', 'thuy'];
  const pts = order.map((_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,82,82,0.6)';
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const [x, y] = pts[(i * 2) % 5];
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  pts.forEach(([x, y], i) => {
    ctx.fillStyle = ELEMENTS[order[i]].css;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.stroke();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#05051a');
  g.addColorStop(0.55, '#24164a');
  g.addColorStop(0.8, '#5a2a5e');
  g.addColorStop(1, '#2a1838');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBackdrop() {
  const grp = new THREE.Group();
  // Sao
  const N = 400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 140;
    pos[i * 3 + 1] = 8 + Math.random() * 45;
    pos[i * 3 + 2] = -35 - Math.random() * 20;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, fog: false }));
  grp.add(stars);

  // Dãy núi xa
  const mountMat = new THREE.MeshStandardMaterial({ color: 0x1b1430, roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const h = 8 + Math.random() * 10;
    const m = new THREE.Mesh(new THREE.ConeGeometry(6 + Math.random() * 5, h, 5), mountMat);
    m.position.set(-44 + i * 11 + (Math.random() - 0.5) * 4, h / 2 - 1, -30 - Math.random() * 6);
    m.rotation.y = Math.random() * Math.PI;
    grp.add(m);
  }

  // 5 cột ngũ hành phía sau sàn
  const order = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
  const pillarGeo = new THREE.CylinderGeometry(0.45, 0.6, 6, 8);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a3450, roughness: 0.8 });
  const orbGeo = new THREE.SphereGeometry(0.55, 16, 12);
  const orbs = [];
  order.forEach((id, i) => {
    const x = -10 + i * 5;
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, 3, -9);
    p.castShadow = true;
    grp.add(p);
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: ELEMENTS[id].color }));
    orb.position.set(x, 6.8, -9);
    grp.add(orb);
    const glow = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({
      color: ELEMENTS[id].color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(1.9);
    orb.add(glow);
    orbs.push(orb);
  });
  grp.userData.orbs = orbs;
  return grp;
}

function buildArenaMeshes(width) {
  const items = {};
  const floorW = width + 6, floorD = 8;
  let floorMat;
  if (loaded.floorDiff) {
    const map = loaded.floorDiff.clone();
    map.repeat.set(floorW / 4, floorD / 4);
    map.needsUpdate = true;
    let normalMap = null;
    if (loaded.floorNor) {
      normalMap = loaded.floorNor.clone();
      normalMap.repeat.copy(map.repeat);
      normalMap.needsUpdate = true;
    }
    floorMat = new THREE.MeshStandardMaterial({ map, normalMap, color: 0x9a94b8, roughness: 0.85, metalness: 0.05 });
  } else {
    floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.7, metalness: 0.1 });
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.4, floorD), floorMat);
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  items.floor = floor;

  // Mặt đất xa (để sàn không lơ lửng giữa không trung)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 120),
    new THREE.MeshStandardMaterial({ color: 0x141022, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.6, -20);
  ground.receiveShadow = true;
  items.ground = ground;

  const emblem = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: makeEmblemTexture(), transparent: true, opacity: 0.75, depthWrite: false })
  );
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.y = 0.012;
  items.emblem = emblem;

  // Viền sàn phát sáng
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x4dd0e1, transparent: true, opacity: 0.8 });
  const edgeGeo = new THREE.BoxGeometry(floorW, 0.08, 0.12);
  for (const z of [-4, 4]) {
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(0, 0.02, z);
    items[`edge${z}`] = edge;
  }

  // 2 biên năng lượng
  const mkWall = (x, color) => {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 2.6), mat);
      seg.position.set(x + Math.sin(i * 0.9) * 0.45, 0.8 + i * 1.3, 0);
      seg.rotation.z = Math.cos(i * 0.9) * 0.22 * Math.sign(x);
      seg.userData.pulse = true;
      grp.add(seg);
    }
    const zone = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 7),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(x - Math.sign(x) * 0.9, 0.02, 0);
    grp.add(zone);
    return grp;
  };
  items.wallL = mkWall(-width / 2, 0xff3860);
  items.wallR = mkWall(width / 2, 0xff3860);
  items.backdrop = buildBackdrop();
  return items;
}

// Có thể ghi đè từ bên ngoài — game chỉ gọi qua object này.
export const AssetBuilders = {
  CharacterBuilder: buildFighter,
  ProjectileBuilder: buildProjectileMesh,
  ArenaBuilder: buildArenaMeshes,
};

export function registerAssets(partial) {
  Object.assign(AssetBuilders, partial);
}
