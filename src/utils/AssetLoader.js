// ============================================================
// AssetLoader — ĐIỂM THAY ASSET DUY NHẤT.
// Gọi preloadAssets() 1 lần trước khi tạo Game. Nếu tải lỗi,
// mọi builder tự fallback về mesh procedural (game vẫn chạy).
//   AssetBuilders.CharacterBuilder = (def) => Group;
//   AssetBuilders.ProjectileBuilder = (skill) => Group (userData.animate(dt,t));
//   AssetBuilders.ArenaBuilder = (width) => { floor, wallL, wallR, ... };
//
// Asset (CC0):
//   models/heroes/*.glb — "RPG Characters" của Quaternius (quaternius.com)
//   textures/floor_*.jpg — Poly Haven "Stone Tiles"
// Vũ khí Tam Quốc, cờ lưng, hiệu ứng chiêu: dựng bằng code bên dưới.
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ELEMENTS } from '../config/elements.js';
import { CHARACTERS } from '../config/characters.js';

const BASE = import.meta.env.BASE_URL;
export const FIGHTER_HEIGHT = 3.2;
const HAN_FONT = '"Noto Serif SC","Noto Serif CJK SC","SimSun","Songti SC","Microsoft YaHei","PingFang SC",serif';

const loaded = {
  heroes: {},        // model -> { scene, clips, scale }
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

function loadHero(model) {
  return new Promise((resolve) => {
    new GLTFLoader().load(`${BASE}models/heroes/${model}.glb`, (gltf) => {
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      // Texture gốc dùng chung giữa các bản clone -> đánh dấu để không bị dispose
      scene.traverse((o) => { if (o.material?.map) o.material.map.userData.shared = true; });
      // Chiều cao tính theo thân (bỏ vũ khí gốc)
      const box = new THREE.Box3();
      scene.traverse((o) => {
        if (o.isMesh && o.material?.name === 'Body') box.expandByObject(o);
      });
      const h = box.isEmpty() ? 0 : box.max.y - box.min.y;
      const scale = Number.isFinite(h) && h > 1e-4 ? FIGHTER_HEIGHT / h : 1;
      for (const clip of gltf.animations) clip.name = clip.name.split('|').pop();
      // Clip lộn nhào khi nhảy: lấy từ Roll, bỏ dịch chuyển gốc để lộn tại chỗ
      const roll = gltf.animations.find((c) => c.name === 'Roll');
      if (roll) {
        const flip = roll.clone();
        flip.name = 'JumpFlip';
        flip.tracks = flip.tracks.filter((t) => !/^(Root|Body|Hips|CharacterArmature)\.position$/.test(t.name));
        gltf.animations.push(flip);
      }
      resolve({ scene, clips: gltf.animations, scale });
    }, undefined, (err) => {
      console.warn('[assets] Không tải được model', model, err);
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
  const models = [...new Set(CHARACTERS.map((c) => c.model).filter(Boolean))];
  const tasks = [
    ...models.map((m) => loadHero(m).then((r) => { if (r) loaded.heroes[m] = r; })),
    loadTexture(tl, `${BASE}textures/floor_diff.jpg`, true).then((t) => { loaded.floorDiff = t; }),
    loadTexture(tl, `${BASE}textures/floor_nor.jpg`, false).then((t) => { loaded.floorNor = t; }),
  ].map((p) => p.then(() => onProgress?.(++done / tasks.length)));
  preloadPromise = Promise.all(tasks).then(() => undefined);
  return preloadPromise;
}

// ------------------------------------------------------------
// Texture dùng chung (vẽ bằng canvas)
// ------------------------------------------------------------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const shared = (t) => { t.userData.shared = true; return t; };

let _glowTex, _fireTex, _streakTex;
function glowTex() {
  return (_glowTex ??= shared(canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  })));
}
function fireTex() {
  return (_fireTex ??= shared(canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 70, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(0.3, 'rgba(255,200,60,0.9)');
    g.addColorStop(0.6, 'rgba(255,90,10,0.5)');
    g.addColorStop(1, 'rgba(200,20,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  })));
}
function streakTex() {
  return (_streakTex ??= shared(canvasTex(256, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
    const v = ctx.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = v; ctx.fillRect(0, 0, 256, 64);
  })));
}
export function getGlowTexture() { return glowTex(); }
export function getFireTexture() { return fireTex(); }

const additive = (color, opacity = 1, map = null) => new THREE.MeshBasicMaterial({
  color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
// Sprite riêng (khiên, đèn lồng, trăng — tạo 1 lần)
const glowSprite = (color, size, opacity = 1, tex = glowTex()) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(size, size, 1);
  return s;
};
// Sprite cho đạn: material dùng chung theo (màu, độ mờ, texture) => không rò bộ nhớ
const spriteMatCache = new Map();
const projSprite = (color, size, opacity = 1, tex = glowTex()) => {
  const key = `${color}|${opacity}|${tex.uuid}`;
  let mat = spriteMatCache.get(key);
  if (!mat) {
    mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    spriteMatCache.set(key, mat);
  }
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
};

// ------------------------------------------------------------
// Vũ khí Tam Quốc (mũi hướng -X, tay cầm ở gốc, đơn vị = thế giới)
// ------------------------------------------------------------
const M = {
  steel: () => new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.85, roughness: 0.25 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xe6b422, metalness: 0.8, roughness: 0.3 }),
  wood: (c = 0x4a2a16) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }),
};
function shaftAlongX(len, r, mat, from) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.rotation.z = Math.PI / 2;
  m.position.x = from - len / 2;
  return m;
}
function tassel(x, color = 0xc81e1e) {
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  t.position.set(x, -0.16, 0);
  t.rotation.z = Math.PI;
  return t;
}

const WEAPONS = {
  // Triệu Vân — Long Đảm Lượng Ngân Thương
  spear() {
    const g = new THREE.Group();
    g.add(shaftAlongX(3.0, 0.035, M.wood(0xd8d8d8), 0.9));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 4), M.steel());
    tip.rotation.z = Math.PI / 2; tip.position.x = -2.35;
    g.add(tip, tassel(-2.0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), M.gold());
    ring.rotation.y = Math.PI / 2; ring.position.x = -2.08;
    g.add(ring);
    return g;
  },
  // Quan Vũ — Thanh Long Yển Nguyệt Đao
  glaive() {
    const g = new THREE.Group();
    g.add(shaftAlongX(2.7, 0.04, M.wood(0x1f4a2a), 0.9));
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(-0.35, 0.05, -0.75, 0.42);
    s.quadraticCurveTo(-0.5, 0.0, -0.62, -0.18);
    s.quadraticCurveTo(-0.3, -0.12, 0, -0.1);
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xcfe8d8, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide })
    );
    blade.position.set(-1.8, 0, -0.015);
    const dragon = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.035, 6, 12), M.gold());
    dragon.rotation.y = Math.PI / 2; dragon.position.x = -1.8;
    g.add(blade, dragon, tassel(-1.7, 0x1e8a3a));
    return g;
  },
  // Gia Cát Lượng — quạt lông vũ
  fan() {
    const g = new THREE.Group();
    g.add(shaftAlongX(0.32, 0.03, M.wood(0x3a2410), 0.05));
    const tex = canvasTex(128, 128, (ctx) => {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.7;
        ctx.save(); ctx.translate(64, 120); ctx.rotate(a + Math.PI / 2);
        const gr = ctx.createLinearGradient(0, 0, 0, -110);
        gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(0.3, '#ffffff'); gr.addColorStop(1, '#f2f2f2');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(0, -60, 12, 58, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    });
    const fan = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 })
    );
    fan.position.set(-0.58, 0, 0);
    fan.rotation.z = Math.PI / 2;
    g.add(fan);
    return g;
  },
  // Chu Du — trường kiếm
  jian() {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.02), M.steel());
    blade.position.x = -0.78;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.057, 0.16, 4), M.steel());
    tip.rotation.z = Math.PI / 2; tip.position.x = -1.48; tip.scale.z = 0.3;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), M.gold());
    guard.position.x = -0.12;
    const grip = shaftAlongX(0.3, 0.03, M.wood(0x2a1a10), 0.18);
    g.add(blade, tip, guard, grip, tassel(0.2));
    return g;
  },
  // Lữ Bố — Phương Thiên Họa Kích (mũi thương + 2 lưỡi trăng khuyết)
  halberd() {
    const g = new THREE.Group();
    g.add(shaftAlongX(3.0, 0.042, M.wood(0x6a1010), 0.9));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 4), M.steel());
    tip.rotation.z = Math.PI / 2; tip.position.x = -2.38;
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(-0.05, 0.32, -0.32, 0.42);
    s.quadraticCurveTo(-0.16, 0.2, -0.3, 0.02);
    s.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide });
    const up = new THREE.Mesh(geo, mat);
    up.position.set(-1.92, 0.04, -0.012);
    const down = new THREE.Mesh(geo, mat);
    down.position.set(-1.92, -0.04, 0.012);
    down.rotation.x = Math.PI;
    g.add(tip, up, down, tassel(-1.82, 0xd42020));
    return g;
  },
  // Mã Siêu — thương kỵ binh dài, tua đỏ
  lance() {
    const g = new THREE.Group();
    g.add(shaftAlongX(3.3, 0.04, M.wood(0xf0f0f0), 0.95));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7, 6), M.steel());
    tip.rotation.z = Math.PI / 2; tip.position.x = -2.68;
    const guard = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.gold());
    guard.position.x = -2.33;
    g.add(tip, guard, tassel(-2.25), tassel(-2.18, 0xffffff));
    return g;
  },
  // Hứa Chử — đại đao bản rộng
  dao() {
    const g = new THREE.Group();
    g.add(shaftAlongX(0.9, 0.045, M.wood(0x2a1a10), 0.45));
    const s = new THREE.Shape();
    s.moveTo(0, -0.06);
    s.lineTo(-1.1, -0.1);
    s.quadraticCurveTo(-1.45, -0.05, -1.5, 0.28);
    s.quadraticCurveTo(-1.0, 0.24, 0, 0.12);
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide })
    );
    blade.position.set(-0.05, 0, -0.015);
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10), M.gold());
    guard.rotation.z = Math.PI / 2; guard.position.x = -0.02;
    g.add(blade, guard, tassel(0.4, 0x1e8a3a));
    return g;
  },
  // Điển Vi — đại phủ (rìu chiến)
  axes() {
    const g = new THREE.Group();
    g.add(shaftAlongX(1.3, 0.04, M.wood(0x3a2410), 0.45));
    const s = new THREE.Shape();
    s.moveTo(0, 0.08);
    s.quadraticCurveTo(0.12, 0.45, 0.32, 0.58);
    s.quadraticCurveTo(0, 0.62, -0.32, 0.58);
    s.quadraticCurveTo(-0.12, 0.45, 0, 0.08);
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide })
    );
    blade.position.set(-0.75, 0, -0.025);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 6), M.steel());
    spike.rotation.z = Math.PI / 2; spike.position.x = -0.95;
    g.add(blade, spike);
    return g;
  },
  // Trương Phi — Trượng Bát Xà Mâu (mũi lượn hình rắn)
  serpent() {
    const g = new THREE.Group();
    g.add(shaftAlongX(2.9, 0.045, M.wood(0x1a1a1a), 0.9));
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const x = -2.0 - i * 0.055;
      pts.push(new THREE.Vector3(x, Math.sin(i * 0.9) * 0.06 * (1 - i / 14), 0));
    }
    const snake = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 6), M.steel());
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), M.steel());
    tip.rotation.z = Math.PI / 2; tip.position.x = -2.74;
    g.add(snake, tip, tassel(-1.95, 0x111111));
    return g;
  },
};

/** Cờ lưng (bối kỳ) — 2 lá cờ thêu họ của tướng */
function makeBanner(text, element) {
  const el = ELEMENTS[element];
  const tex = canvasTex(128, 192, (ctx, w, h) => {
    ctx.fillStyle = el.css; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(14, 14, w - 28, h - 28);
    ctx.font = `bold 92px ${HAN_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = el.id === 'kim' ? '#1a1a1a' : '#fff8e0';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
  const g = new THREE.Group();
  const flagMat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
  const poleMat = M.wood(0x2a1a10);
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.rotation.z = side * 0.32;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), poleMat);
    pole.position.y = 0.85;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), flagMat);
    flag.position.set(side * 0.22, 1.32, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.gold());
    knob.position.y = 1.72;
    arm.add(pole, flag, knob);
    g.add(arm);
  }
  return g;
}

/** Gắn object vào xương, quy đổi để đơn vị con = đơn vị thế giới */
function attachToBone(model, boneName, obj) {
  const bone = model.getObjectByName(boneName);
  if (!bone) return false;
  const ws = bone.getWorldScale(new THREE.Vector3());
  const holder = new THREE.Group();
  holder.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  holder.add(obj);
  bone.add(holder);
  return true;
}

// ------------------------------------------------------------
// Nhân vật
// ------------------------------------------------------------
function addFootDisc(g, color) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  g.add(disc);
  const discRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  discRing.rotation.x = -Math.PI / 2;
  discRing.position.y = 0.03;
  g.add(discRing);
  g.userData.discs = [disc, discRing]; // Character giữ đĩa bám đất khi nhảy
}

function buildHeroFighter(def, src) {
  const el = ELEMENTS[def.element];
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(src.scene);
  model.scale.setScalar(src.scale);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.sharedGeo = true;
    o.castShadow = true;
    o.frustumCulled = false; // skinned mesh hay bị cull sai khi chạy animation
    o.material = o.material.clone();
    const m = o.material;
    if (m.name === 'Weapon' && def.weapon) o.visible = false; // thay bằng vũ khí Tam Quốc
    if (m.name === 'Body' && def.tint) m.color.setHex(def.tint);
    if (m.emissive) {
      m.emissive.setHex(el.color);
      m.emissiveIntensity = 0.06;
    }
  });
  model.updateMatrixWorld(true);
  const weapon = def.weapon && WEAPONS[def.weapon]?.();
  if (weapon) {
    weapon.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    attachToBone(model, 'WeaponR', weapon);
  }
  if (def.banner) {
    const banner = makeBanner(def.banner, def.element);
    banner.position.set(0, 0.1, -0.32);
    banner.rotation.x = -0.15;
    attachToBone(model, 'Torso', banner);
  }
  root.add(model);
  addFootDisc(root, el.color);
  root.userData.animRoot = model;
  root.userData.clips = src.clips;
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
    color: el.color, roughness: 0.35, metalness: 0.2, emissive: el.color, emissiveIntensity: 0.3,
  });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 6, 14), bodyMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe8c9, roughness: 0.4, emissive: el.color, emissiveIntensity: 0.1 })
  );
  head.position.y = 2.55;
  head.castShadow = true;
  const armGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.72, 1.6, 0);
  armL.rotation.z = 0.25;
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.72, 1.6, 0);
  armR.rotation.z = -0.25;
  body.add(torso, head, armL, armR);
  body.scale.setScalar(1.2);
  addFootDisc(g, el.color);
  g.userData.armR = armR;
  g.userData.height = 3.7;
  g.userData.yawRight = 0.5;
  g.userData.yawLeft = -0.5;
  return g;
}

function buildFighter(def) {
  const src = loaded.heroes[def.model];
  return src ? buildHeroFighter(def, src) : buildProceduralFighter(def);
}

/** Khiên Đỡ: nửa vòm phía trước nhân vật (+X), Character lật theo hướng mặt */
function buildShield(element) {
  const color = ELEMENTS[element].color;
  const g = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 28, 18, Math.PI / 2, Math.PI, 0.15, Math.PI - 0.3),
    additive(color, 0.35)
  );
  dome.scale.set(0.55, 1.25, 1);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 6, 40), additive(0xffffff, 0.8));
  rim.rotation.y = Math.PI / 2;
  rim.scale.set(1.25, 1.25, 1);
  rim.position.x = 0.05;
  const glow = glowSprite(color, 3.6, 0.5);
  glow.position.x = 0.5;
  g.add(dome, rim, glow);
  g.position.set(0.55, 1.7, 0);
  g.userData.mats = [dome.material, rim.material, glow.material];
  g.visible = false;
  return g;
}

// ------------------------------------------------------------
// Đạn chiêu — mỗi hệ một kiểu, dựng hướng +X (Projectile xoay theo hướng bắn).
// Geometry/material dùng chung theo (hệ, cấp chiêu) => không tạo rác mỗi phát.
// ------------------------------------------------------------
const projCache = new Map();
function cached(key, make) {
  if (!projCache.has(key)) projCache.set(key, make());
  return projCache.get(key);
}

// Kim — mũi thương ánh bạc
function projKim(skill) {
  const s = skill.size, ult = skill.isUltimate;
  const P = cached(`kim${skill.index}`, () => ({
    blade: new THREE.OctahedronGeometry(1, 0),
    bladeMat: new THREE.MeshBasicMaterial({ color: 0xf4f8ff }),
    edgeMat: additive(0xbfd8ff, 0.55),
    streakMat: additive(0xd7e6ff, 0.8, streakTex()),
    streak: new THREE.PlaneGeometry(1, 1),
    ring: new THREE.TorusGeometry(1, 0.06, 6, 32),
    ringMat: additive(0xfff3b0, 0.85),
  }));
  const g = new THREE.Group();
  const spin = new THREE.Group();
  const blade = new THREE.Mesh(P.blade, P.bladeMat);
  blade.scale.set(s * 2.4, s * 0.38, s * 0.38);
  const edge = new THREE.Mesh(P.blade, P.edgeMat);
  edge.scale.set(s * 3.0, s * 0.7, s * 0.7);
  spin.add(blade, edge);
  g.add(spin);
  const streak = new THREE.Mesh(P.streak, P.streakMat);
  streak.scale.set(s * 7, s * 1.1, 1);
  streak.position.x = -s * 4;
  g.add(streak, projSprite(0xdfe8ff, s * 4.5, 0.9));
  const orbit = new THREE.Group();
  if (ult) {
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(P.blade, P.bladeMat);
      b.scale.set(s * 1.1, s * 0.18, s * 0.18);
      const a = (i / 3) * Math.PI * 2;
      b.position.set(0, Math.cos(a) * s * 1.4, Math.sin(a) * s * 1.4);
      orbit.add(b);
    }
    const ring = new THREE.Mesh(P.ring, P.ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.scale.setScalar(s * 1.6);
    orbit.add(ring);
    g.add(orbit);
  }
  g.userData.animate = (dt) => {
    spin.rotation.x += dt * 14;
    orbit.rotation.x -= dt * 6;
  };
  return g;
}

// Mộc — đao khí trăng lưỡi liềm (Yển Nguyệt)
function projMoc(skill) {
  const s = skill.size, ult = skill.isUltimate;
  const P = cached(`moc${skill.index}`, () => {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 1, -Math.PI * 0.62, Math.PI * 0.62, false);
    sh.absarc(-0.42, 0, 0.82, Math.PI * 0.55, -Math.PI * 0.55, true);
    return {
      crescent: new THREE.ShapeGeometry(sh, 24),
      outer: additive(0x5dff7a, 0.9),
      inner: new THREE.MeshBasicMaterial({ color: 0xe9ffe0, side: THREE.DoubleSide }),
    };
  });
  const g = new THREE.Group();
  const wob = new THREE.Group();
  const c1 = new THREE.Mesh(P.crescent, P.outer);
  c1.scale.setScalar(s * 2.0);
  const c2 = new THREE.Mesh(P.crescent, P.inner);
  c2.scale.setScalar(s * 1.55);
  c2.position.x = s * 0.15;
  wob.add(c1, c2);
  if (ult) {
    for (const k of [0.75, 0.55]) {
      const c = new THREE.Mesh(P.crescent, P.outer);
      c.scale.setScalar(s * 2.0 * k);
      c.position.x = -s * (1.6 - k);
      wob.add(c);
    }
  }
  g.add(wob, projSprite(0x2ecc71, s * 5, 0.8));
  g.userData.animate = (dt, t) => {
    wob.rotation.x = Math.sin(t * 9) * 0.45;
  };
  return g;
}

// Thủy — cầu nước + vòng xoáy
function projThuy(skill) {
  const s = skill.size, ult = skill.isUltimate;
  const P = cached(`thuy${skill.index}`, () => ({
    orb: new THREE.SphereGeometry(1, 20, 16),
    orbMat: new THREE.MeshBasicMaterial({ color: 0x5ec8ff, transparent: true, opacity: 0.7, depthWrite: false }),
    coreMat: new THREE.MeshBasicMaterial({ color: 0xe8f8ff }),
    ring: new THREE.TorusGeometry(1, 0.07, 6, 36),
    ringMat: additive(0x9fe0ff, 0.85),
  }));
  const g = new THREE.Group();
  const orb = new THREE.Mesh(P.orb, P.orbMat);
  orb.scale.setScalar(s);
  const core = new THREE.Mesh(P.orb, P.coreMat);
  core.scale.setScalar(s * 0.45);
  g.add(orb, core, projSprite(0x3498db, s * 4.2, 0.9));
  const rings = [];
  const n = ult ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const r = new THREE.Mesh(P.ring, P.ringMat);
    if (ult) {
      r.rotation.y = Math.PI / 2;
      r.position.x = -i * s * 0.55;
      r.scale.setScalar(s * (1.5 - i * 0.18));
    } else {
      r.scale.setScalar(s * 1.45);
      r.rotation.set(i * 1.2, i * 0.7, 0);
    }
    rings.push(r);
    g.add(r);
  }
  g.userData.animate = (dt, t) => {
    rings.forEach((r, i) => {
      if (ult) r.rotation.x += dt * (6 + i);
      else { r.rotation.x += dt * (4 + i * 3); r.rotation.y += dt * 3; }
    });
    const k = 1 + Math.sin(t * 18) * 0.06;
    orb.scale.set(s * k, s / k, s * k);
  };
  return g;
}

// Hỏa — cầu lửa; tuyệt chiêu có cánh phượng hoàng
function projHoa(skill) {
  const s = skill.size, ult = skill.isUltimate;
  const P = cached(`hoa${skill.index}`, () => {
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.quadraticCurveTo(-0.4, 0.9, -1.6, 1.2);
    wing.quadraticCurveTo(-1.1, 0.75, -1.3, 0.45);
    wing.quadraticCurveTo(-0.9, 0.35, -1.0, 0.1);
    wing.quadraticCurveTo(-0.5, 0.1, 0, 0);
    return {
      core: new THREE.SphereGeometry(1, 16, 12),
      coreMat: new THREE.MeshBasicMaterial({ color: 0xfff1c0 }),
      wing: new THREE.ShapeGeometry(wing, 12),
      wingMat: additive(0xff8a2a, 0.9),
    };
  });
  const g = new THREE.Group();
  const core = new THREE.Mesh(P.core, P.coreMat);
  core.scale.setScalar(s * 0.6);
  g.add(core, projSprite(0xff6a00, s * 5, 0.9));
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = projSprite(0xffffff, s * 2, 0.95, fireTex());
    f.userData.ph = Math.random() * 6;
    flames.push(f);
    g.add(f);
  }
  const wings = [];
  if (ult) {
    for (const side of [1, -1]) {
      const w = new THREE.Mesh(P.wing, P.wingMat);
      w.scale.set(s * 1.6, s * 1.6 * side, s * 1.6);
      wings.push(w);
      g.add(w);
    }
  }
  g.userData.animate = (dt, t) => {
    flames.forEach((f, i) => {
      const ph = f.userData.ph + t * 14;
      f.position.set(-s * (0.2 + i * 0.32), Math.sin(ph) * s * 0.18, Math.cos(ph) * s * 0.18);
      const k = s * (2.2 - i * 0.3) * (0.85 + Math.sin(ph * 1.7) * 0.15);
      f.scale.set(k, k, 1);
    });
    wings.forEach((w, i) => { w.rotation.x = (i ? -1 : 1) * (0.2 + Math.sin(t * 12) * 0.5); });
  };
  return g;
}

// Thổ — tảng đá lăn; tuyệt chiêu là thiên thạch nham thạch
function projTho(skill) {
  const s = skill.size, ult = skill.isUltimate;
  const P = cached(`tho${skill.index}`, () => ({
    rock: new THREE.DodecahedronGeometry(1, 0),
    rockMat: new THREE.MeshStandardMaterial({
      color: 0x8a5a2b, roughness: 0.95, flatShading: true,
      emissive: ult ? 0xff4400 : 0x3a1800, emissiveIntensity: ult ? 0.55 : 0.4,
    }),
    shell: additive(0xffb050, 0.25),
  }));
  const g = new THREE.Group();
  const rock = new THREE.Mesh(P.rock, P.rockMat);
  rock.scale.setScalar(s * 1.05);
  rock.castShadow = true;
  const shell = new THREE.Mesh(P.rock, P.shell);
  shell.scale.setScalar(s * 1.3);
  g.add(rock, shell, projSprite(ult ? 0xff6a10 : 0xd9a441, s * 3.8, 0.7));
  const chunks = [];
  const nChunks = ult ? 6 : 3;
  for (let i = 0; i < nChunks; i++) {
    const c = new THREE.Mesh(P.rock, P.rockMat);
    c.scale.setScalar(s * 0.28);
    c.userData.a = (i / nChunks) * Math.PI * 2;
    chunks.push(c);
    g.add(c);
  }
  if (ult) {
    for (let i = 0; i < 3; i++) {
      const f = projSprite(0xffffff, s * 2.4, 0.9, fireTex());
      f.position.x = -s * (0.8 + i * 0.6);
      g.add(f);
    }
  }
  g.userData.animate = (dt, t) => {
    rock.rotation.z -= dt * 8;
    rock.rotation.x += dt * 2;
    chunks.forEach((c) => {
      const a = c.userData.a + t * 7;
      c.position.set(-s * 0.3, Math.cos(a) * s * 1.5, Math.sin(a) * s * 1.5);
      c.rotation.x += dt * 9;
    });
  };
  return g;
}

// Cận chiến — nhát chém vòng cung (quét từ trên xuống), màu theo hệ
const SLASH_COLORS = {
  kim: [0xf4f8ff, 0xbfd8ff], moc: [0xe9ffe0, 0x4dff70], thuy: [0xe8f8ff, 0x4fb8ff],
  hoa: [0xfff1c0, 0xff6a1a], tho: [0xfff0d0, 0xe0a040],
};
function projSlash(skill) {
  const s = skill.size, ult = skill.isUltimate;
  const [cCore, cGlow] = SLASH_COLORS[skill.element] ?? SLASH_COLORS.kim;
  const P = cached(`slash${skill.element}${skill.index}`, () => ({
    outer: new THREE.RingGeometry(0.62, 1, 40, 1, -1.05, 2.1),
    inner: new THREE.RingGeometry(0.86, 0.97, 40, 1, -0.95, 1.9),
    glowMat: additive(cGlow, 0.85),
    coreMat: new THREE.MeshBasicMaterial({ color: cCore, side: THREE.DoubleSide }),
  }));
  const g = new THREE.Group();
  const sweep = new THREE.Group();
  const R = s * 2.6;
  const a = new THREE.Mesh(P.outer, P.glowMat);
  const b = new THREE.Mesh(P.inner, P.coreMat);
  a.scale.setScalar(R); b.scale.setScalar(R);
  sweep.add(a, b);
  if (ult) {
    const c = new THREE.Mesh(P.outer, P.glowMat);
    c.scale.setScalar(R * 0.75);
    c.rotation.z = Math.PI; // nhát chém ngược chiều tạo hình chữ X
    c.position.x = R * 0.25;
    sweep.add(c);
  }
  sweep.position.x = -R * 0.55;
  g.add(sweep, projSprite(cGlow, s * 4, 0.7));
  g.userData.animate = (dt, t) => {
    sweep.rotation.z = 0.7 - Math.min(1, t * 6) * 1.4;
    sweep.scale.setScalar(0.85 + Math.min(1, t * 8) * 0.25);
  };
  return g;
}

const PROJ_BUILDERS = { kim: projKim, moc: projMoc, thuy: projThuy, hoa: projHoa, tho: projTho };
function buildProjectileMesh(skill) {
  if (skill.melee) return projSlash(skill);
  return (PROJ_BUILDERS[skill.element] ?? projThuy)(skill);
}

// ------------------------------------------------------------
// Sàn đấu + phông nền Tam Quốc
// ------------------------------------------------------------
function makeEmblemTexture() {
  return canvasTex(512, 512, (ctx) => {
    const cx = 256, cy = 256, R = 200;
    ctx.strokeStyle = 'rgba(255,215,0,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, R + 30, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R + 44, 0, Math.PI * 2); ctx.stroke();
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
    const han = { moc: '木', hoa: '火', tho: '土', kim: '金', thuy: '水' };
    pts.forEach(([x, y], i) => {
      ctx.fillStyle = ELEMENTS[order[i]].css;
      ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = `bold 36px ${HAN_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(han[order[i]], x, y + 2);
    });
  });
}

export function makeSkyTexture() {
  return canvasTex(4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#070716');
    g.addColorStop(0.5, '#1f1640');
    g.addColorStop(0.78, '#5a2a4e');
    g.addColorStop(1, '#2a1830');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  });
}

function makeTextPlank(text, w, h, bg, fg, font = 110) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 12; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.font = `bold ${font}px ${HAN_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, h / 2 + 6);
  });
}

/** Cổng tam quan (bài lâu) phía sau lôi đài */
function buildGate() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x9e1b1b, roughness: 0.6 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x1d2a2a, roughness: 0.8, flatShading: true });
  const gold = M.gold();
  for (const x of [-4.2, 4.2]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 8, 12), red);
    col.position.set(x, 4, 0);
    col.castShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), new THREE.MeshStandardMaterial({ color: 0x5a5560 }));
    base.position.set(x, 0.4, 0);
    g.add(col, base);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.55, 0.6), red);
  beam.position.y = 7.1;
  const beam2 = beam.clone();
  beam2.position.y = 6.0;
  beam2.scale.x = 0.85;
  g.add(beam, beam2);
  // Mái cong (đầu mái vểnh)
  const sh = new THREE.Shape();
  sh.moveTo(-6.8, 0.35); sh.quadraticCurveTo(-5.6, -0.15, -4.5, 0.25); sh.lineTo(0, 1.6);
  sh.lineTo(4.5, 0.25); sh.quadraticCurveTo(5.6, -0.15, 6.8, 0.35); sh.lineTo(6.2, 0.6); sh.lineTo(0, 2.0); sh.lineTo(-6.2, 0.6);
  const roofMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false }), roof);
  roofMesh.position.set(0, 7.35, -0.8);
  roofMesh.castShadow = true;
  g.add(roofMesh);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.1),
    new THREE.MeshStandardMaterial({ map: makeTextPlank('三國五行', 512, 160, '#1a1030', '#ffd700', 100), roughness: 0.6 })
  );
  plaque.position.set(0, 6.55, 0.33);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.3, 0.1), gold);
  frame.position.set(0, 6.55, 0.27);
  g.add(frame, plaque);
  return g;
}

function buildLantern() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xd42020, emissive: 0xff3010, emissiveIntensity: 0.9, roughness: 0.6 })
  );
  body.scale.y = 0.8;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.12, 10), M.gold());
  top.position.y = 0.36;
  const bot = top.clone();
  bot.position.y = -0.36;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  string.position.y = 0.8;
  const glow = glowSprite(0xff5020, 2.2, 0.55);
  g.add(body, top, bot, string, glow);
  g.userData.glow = glow;
  return g;
}

/** Cờ trận các nước (Ngụy, Thục, Ngô, Hán) */
function buildWarBanner(text, color, clothSide = 1) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 9, 8), M.wood(0x2a1a10));
  pole.position.y = 4.5;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), M.gold());
  tip.position.y = 9.2;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 3.6, 1, 8),
    new THREE.MeshStandardMaterial({ map: makeTextPlank(text, 256, 576, color, '#fff8e0', 170), side: THREE.DoubleSide, roughness: 0.9 })
  );
  cloth.position.set(0.85 * clothSide, 6.8, 0);
  g.add(pole, tip, cloth);
  g.userData.cloth = cloth;
  return g;
}

function buildBackdrop() {
  const grp = new THREE.Group();
  // Sao
  const N = 400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 160;
    pos[i * 3 + 1] = 10 + Math.random() * 50;
    pos[i * 3 + 2] = -40 - Math.random() * 20;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  grp.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, fog: false })));

  // Trăng
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false }));
  moon.position.set(-22, 26, -55);
  const moonGlow = glowSprite(0xffe0a0, 22, 0.35);
  moonGlow.material.fog = false;
  moonGlow.position.copy(moon.position);
  grp.add(moon, moonGlow);

  // Dãy núi xa (kiểu tranh thủy mặc, 3 lớp đậm nhạt)
  const mountMats = [0x231a3a, 0x1b1430, 0x140f24].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 9; i++) {
      const h = 10 + Math.random() * 12 - layer * 2;
      const m = new THREE.Mesh(new THREE.ConeGeometry(5 + Math.random() * 5, h, 6), mountMats[layer]);
      m.position.set(-48 + i * 12 + (Math.random() - 0.5) * 6, h / 2 - 1, -26 - layer * 7 - Math.random() * 3);
      m.rotation.y = Math.random() * Math.PI;
      grp.add(m);
    }
  }

  const gate = buildGate();
  gate.position.set(0, 0, -10);
  grp.add(gate);

  const lanterns = [];
  for (const x of [-3.2, 3.2]) {
    const l = buildLantern();
    l.position.set(x, 5.2, -9.6);
    grp.add(l);
    lanterns.push(l);
  }
  // Cờ trận + đèn lồng hai bên
  const banners = [];
  [['魏', '#1f3f8f', -13], ['蜀', '#1e7a3a', -9], ['吳', '#a01e1e', 9], ['漢', '#7a5a10', 13]].forEach(([t, c, x]) => {
    const b = buildWarBanner(t, c, x > 0 ? -1 : 1);
    b.position.set(x, 0, -8 - Math.abs(x) * 0.1);
    grp.add(b);
    banners.push(b);
    const l = buildLantern();
    l.position.set(x * 0.82, 3.2, -6.5);
    grp.add(l);
    lanterns.push(l);
  });
  grp.userData.lanterns = lanterns;
  grp.userData.banners = banners;
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
    floorMat = new THREE.MeshStandardMaterial({ map, normalMap, color: 0xa49cb8, roughness: 0.85, metalness: 0.05 });
  } else {
    floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.7, metalness: 0.1 });
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.4, floorD), floorMat);
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  items.floor = floor;

  // Viền gỗ sơn đỏ quanh lôi đài
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8e1a1a, roughness: 0.6 });
  for (const z of [-4.1, 4.1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(floorW + 0.4, 0.5, 0.25), trimMat);
    trim.position.set(0, -0.15, z);
    items[`trim${z}`] = trim;
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 140),
    new THREE.MeshStandardMaterial({ color: 0x15101f, roughness: 1 })
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

/**
 * Chụp chân dung từng tướng (dùng cho màn chọn tướng).
 * Dùng 1 renderer tạm rồi giải phóng ngay. Trả về { [id]: dataURL }.
 */
export function renderPortraits(defs, size = 192) {
  const out = {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 4, 5);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0.25, 2.3, 5.4);
  cam.lookAt(0, 1.95, 0);
  for (const def of defs) {
    if (!loaded.heroes[def.model]) continue;
    const fig = buildFighter(def);
    fig.children.forEach((c) => { if (c !== fig.userData.animRoot) c.visible = false; }); // ẩn đĩa dưới chân
    fig.rotation.y = 0.35;
    const clips = fig.userData.clips || [];
    const clip = clips.find((c) => c.name === 'Idle_Weapon') || clips.find((c) => c.name === 'Idle');
    if (clip) {
      const mixer = new THREE.AnimationMixer(fig.userData.animRoot);
      mixer.clipAction(clip).play();
      mixer.update(0.4);
    }
    scene.add(fig);
    renderer.render(scene, cam);
    out[def.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(fig);
    fig.traverse((o) => {
      if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
      if (o.isSkinnedMesh) o.skeleton?.dispose();
      if (o.material) {
        if (o.material.map && !o.material.map.userData.shared) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}

// Có thể ghi đè từ bên ngoài — game chỉ gọi qua object này.
export const AssetBuilders = {
  CharacterBuilder: buildFighter,
  ProjectileBuilder: buildProjectileMesh,
  ArenaBuilder: buildArenaMeshes,
  ShieldBuilder: buildShield,
};

export function registerAssets(partial) {
  Object.assign(AssetBuilders, partial);
}
