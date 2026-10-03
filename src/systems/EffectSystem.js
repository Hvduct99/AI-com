// ============================================================
// EffectSystem — particle, vòng sóng xung kích, cột sáng, chữ bay.
// Particle: 1 InstancedMesh (1 draw call, không tạo object mới).
// Vòng/cột sáng: pool mesh dùng lại. Chữ: cache texture theo nội dung.
// ============================================================
import * as THREE from 'three';
import { getGlowTexture } from '../utils/AssetLoader.js';

const MAX_PARTICLES = 900;
const MAX_TEXTS = 40;
const POOL_RINGS = 16;
const POOL_FLASH = 12;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _offset = new THREE.Vector3(0, 0.8, 0);

// Bảng màu + "tính cách" hạt theo hệ
const PALETTE = {
  kim: [0xffffff, 0xdfe8ff, 0xfff3b0],
  moc: [0x7dff8a, 0x2ecc71, 0xc8ff70],
  thuy: [0x8fd8ff, 0x3498db, 0xffffff],
  hoa: [0xffd27a, 0xff7a1a, 0xff3b1a],
  tho: [0xd9a441, 0x8a5a2b, 0xf0d090],
};
const TRAIL = {
  kim: { g: 0, life: 0.22, spread: 0.25, size: 0.6, n: 1 },
  moc: { g: 0.6, life: 0.7, spread: 0.9, size: 0.9, n: 1 },
  thuy: { g: 7, life: 0.5, spread: 0.6, size: 0.8, n: 1 },
  hoa: { g: -5, life: 0.45, spread: 0.7, size: 1.2, n: 2 },
  tho: { g: 11, life: 0.6, spread: 0.8, size: 1.3, n: 1 },
};
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class EffectSystem {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.SphereGeometry(0.09, 6, 5);
    // Additive blending: nhân màu với k để fade (không cần opacity riêng)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) this.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    scene.add(this.mesh);

    this.n = 0;
    this.px = new Float32Array(MAX_PARTICLES * 3);
    this.pv = new Float32Array(MAX_PARTICLES * 3);
    this.pc = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.size = new Float32Array(MAX_PARTICLES);
    this.grav = new Float32Array(MAX_PARTICLES);

    // Pool vòng sóng (mặt phẳng XY hướng camera, hoặc nằm trên sàn)
    const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    this.rings = [];
    for (let i = 0; i < POOL_RINGS; i++) {
      const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      r.visible = false;
      r.userData = { life: 0, max: 1, from: 1, to: 2 };
      scene.add(r);
      this.rings.push(r);
    }
    // Pool chớp sáng (sprite)
    this.flashes = [];
    for (let i = 0; i < POOL_FLASH; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.visible = false;
      s.userData = { life: 0, max: 1, from: 1, to: 2 };
      scene.add(s);
      this.flashes.push(s);
    }
    // Cột sáng khi ra tuyệt chiêu
    this.pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.3, 14, 32, 1, true),
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
    this.pillar.visible = false;
    this.pillar.userData = { life: 0, max: 0.8 };
    scene.add(this.pillar);

    this.texts = [];
    this.texCache = new Map();
  }

  _spawn(x, y, z, vx, vy, vz, colorHex, life, size, g = 9) {
    if (this.n >= MAX_PARTICLES) return;
    const i = this.n++;
    const i3 = i * 3;
    this.px[i3] = x; this.px[i3 + 1] = y; this.px[i3 + 2] = z;
    this.pv[i3] = vx; this.pv[i3 + 1] = vy; this.pv[i3 + 2] = vz;
    _c.setHex(colorHex);
    this.pc[i3] = _c.r; this.pc[i3 + 1] = _c.g; this.pc[i3 + 2] = _c.b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = g;
  }

  _remove(i) {
    const last = --this.n;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      this.px[i3 + k] = this.px[l3 + k];
      this.pv[i3 + k] = this.pv[l3 + k];
      this.pc[i3 + k] = this.pc[l3 + k];
    }
    this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
    this.size[i] = this.size[last]; this.grav[i] = this.grav[last];
  }

  _take(pool) {
    let best = pool[0];
    for (const o of pool) {
      if (!o.visible) return o;
      if (o.userData.life < best.userData.life) best = o;
    }
    return best; // pool đầy: dùng lại cái sắp tắt nhất
  }

  ring(pos, colorHex, { from = 0.3, to = 2.5, life = 0.45, ground = false, opacity = 0.9 } = {}) {
    const r = this._take(this.rings);
    r.visible = true;
    r.position.copy(pos);
    if (ground) r.position.y = 0.05;
    r.rotation.set(ground ? -Math.PI / 2 : 0, 0, 0);
    r.material.color.setHex(colorHex);
    Object.assign(r.userData, { life, max: life, from, to, opacity });
    r.scale.setScalar(from);
  }

  flash(pos, colorHex, { from = 1, to = 3.5, life = 0.25, opacity = 1 } = {}) {
    const s = this._take(this.flashes);
    s.visible = true;
    s.position.copy(pos);
    s.material.color.setHex(colorHex);
    Object.assign(s.userData, { life, max: life, from, to, opacity });
    s.scale.set(from, from, 1);
  }

  burst(pos, colorHex, count = 18, speed = 5, up = 2, palette = null, g = 9) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.9);
      this._spawn(
        pos.x, pos.y, pos.z,
        Math.cos(a) * s, Math.random() * up + 1, (Math.random() - 0.5) * 3,
        palette ? pick(palette) : colorHex, 0.4 + Math.random() * 0.5, 1, g
      );
    }
  }

  trail(pos, element, big = false) {
    const t = TRAIL[element] ?? TRAIL.kim;
    const pal = PALETTE[element] ?? PALETTE.kim;
    const n = t.n * (big ? 3 : 1);
    for (let i = 0; i < n; i++) {
      const sp = t.spread * (big ? 2 : 1);
      this._spawn(
        pos.x + (Math.random() - 0.5) * sp * 0.6, pos.y + (Math.random() - 0.5) * sp, pos.z + (Math.random() - 0.5) * sp,
        (Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp + (t.g < 0 ? 0.8 : 0), (Math.random() - 0.5) * sp,
        pick(pal), t.life * (0.7 + Math.random() * 0.6), t.size * (big ? 1.6 : 1) * (0.7 + Math.random() * 0.6), t.g
      );
    }
  }

  /** Nổ khi trúng: hạt theo hệ + vòng sóng + chớp sáng */
  impact(pos, element, big = false) {
    const pal = PALETTE[element] ?? PALETTE.kim;
    const g = (TRAIL[element] ?? TRAIL.kim).g;
    this.burst(pos, pal[0], big ? 50 : 20, big ? 9 : 5, 3, pal, g === 0 ? 4 : g);
    this.ring(pos, pal[1], { from: 0.2, to: big ? 4.5 : 2.2, life: big ? 0.55 : 0.35 });
    if (big) this.ring(pos, pal[0], { from: 0.5, to: 5.5, life: 0.7, ground: true, opacity: 0.7 });
    this.flash(pos, pal[0], { from: big ? 2 : 1, to: big ? 7 : 3.5, life: big ? 0.35 : 0.2 });
  }

  shieldHit(pos, element, perfect) {
    const pal = PALETTE[element] ?? PALETTE.kim;
    this.burst(pos, 0xffffff, perfect ? 30 : 14, perfect ? 7 : 4, 2, perfect ? [0xffffff, 0x7dffb0, pal[0]] : pal, 6);
    this.ring(pos, perfect ? 0x7dffb0 : 0xbde0ff, { from: 0.4, to: perfect ? 3.5 : 2, life: 0.35 });
    this.flash(pos, perfect ? 0xcfffe0 : 0xffffff, { from: 1, to: perfect ? 5 : 3, life: 0.2 });
  }

  /** Lóe sáng ở tay khi ra chiêu thường */
  muzzle(pos, element) {
    const pal = PALETTE[element] ?? PALETTE.kim;
    this.flash(pos, pal[1], { from: 0.6, to: 2, life: 0.18, opacity: 0.9 });
    this.burst(pos, pal[0], 6, 3, 1, pal, (TRAIL[element] ?? TRAIL.kim).g);
  }

  /** Ra tuyệt chiêu: cột sáng + vòng dưới chân + bụi hạt */
  ultiCast(pos, element) {
    const pal = PALETTE[element] ?? PALETTE.kim;
    const p = this.pillar;
    p.visible = true;
    p.position.set(pos.x, 7, 0);
    p.material.color.setHex(pal[1]);
    p.userData.life = p.userData.max;
    this.ring(pos, pal[0], { from: 0.5, to: 6, life: 0.8, ground: true });
    this.ring(pos, pal[1], { from: 0.2, to: 3.5, life: 0.6, ground: true });
    _p.set(pos.x, 1.6, 0);
    this.flash(_p, pal[0], { from: 3, to: 9, life: 0.5, opacity: 0.8 });
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 1.5;
      this._spawn(pos.x + Math.cos(a) * r, 0.1, Math.sin(a) * r, Math.cos(a) * 0.5, 4 + Math.random() * 6, Math.sin(a) * 0.5,
        pick(pal), 0.6 + Math.random() * 0.6, 1.2, 2);
    }
  }

  _textTexture(text, cssColor, big) {
    const key = `${text}|${cssColor}|${big}`;
    let tex = this.texCache.get(key);
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = 320; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.font = `800 ${big ? 48 : 34}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, 160, 62, 310);
    ctx.fillStyle = cssColor;
    ctx.fillText(text, 160, 62, 310);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (this.texCache.size > 120) {
      for (const [k, t] of this.texCache) {
        if (!this.texts.some((x) => x.sprite.material.map === t)) {
          t.dispose(); this.texCache.delete(k); break;
        }
      }
    }
    this.texCache.set(key, tex);
    return tex;
  }

  hitText(pos, text, cssColor = '#fff', big = false) {
    if (this.texts.length >= MAX_TEXTS) this._removeText(0);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._textTexture(text, cssColor, big), depthTest: false, transparent: true,
    }));
    sp.renderOrder = 10;
    sp.position.copy(pos).add(_offset);
    sp.position.x += (Math.random() - 0.5) * 0.4;
    sp.scale.set(big ? 3.6 : 2.6, big ? 1.08 : 0.78, 1);
    this.scene.add(sp);
    this.texts.push({ sprite: sp, life: 0.9, vy: 2.2 });
  }

  _removeText(i) {
    const t = this.texts[i];
    this.scene.remove(t.sprite);
    t.sprite.material.dispose();
    this.texts.splice(i, 1);
  }

  update(dt) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._remove(i); continue; }
      const i3 = i * 3;
      this.pv[i3 + 1] -= this.grav[i] * dt;
      this.px[i3] += this.pv[i3] * dt;
      this.px[i3 + 1] += this.pv[i3 + 1] * dt;
      this.px[i3 + 2] += this.pv[i3 + 2] * dt;
      if (this.px[i3 + 1] < 0.05) { this.px[i3 + 1] = 0.05; this.pv[i3 + 1] *= -0.4; }
    }
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      const k = this.life[i] / this.maxLife[i];
      const sc = (0.4 + k) * this.size[i];
      _m.compose(_p.set(this.px[i3], this.px[i3 + 1], this.px[i3 + 2]), _q, _s.set(sc, sc, sc));
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.setRGB(this.pc[i3] * k, this.pc[i3 + 1] * k, this.pc[i3 + 2] * k));
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;

    for (const o of this.rings) this._tickGrow(o, dt, true);
    for (const o of this.flashes) this._tickGrow(o, dt, false);
    const p = this.pillar;
    if (p.visible) {
      p.userData.life -= dt;
      if (p.userData.life <= 0) p.visible = false;
      else {
        const k = p.userData.life / p.userData.max;
        p.material.opacity = Math.sin(k * Math.PI) * 0.9;
        p.scale.set(0.6 + (1 - k) * 1.2, 1, 0.6 + (1 - k) * 1.2);
        p.rotation.y += dt * 3;
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this._removeText(i); continue; }
      t.sprite.position.y += t.vy * dt;
      t.sprite.material.opacity = Math.min(1, t.life * 2);
    }
  }

  _tickGrow(o, dt, uniform) {
    if (!o.visible) return;
    const u = o.userData;
    u.life -= dt;
    if (u.life <= 0) { o.visible = false; return; }
    const k = u.life / u.max;            // 1 -> 0
    const e = 1 - k * k;                 // ease-out
    const s = u.from + (u.to - u.from) * e;
    if (uniform) o.scale.setScalar(s); else o.scale.set(s, s, 1);
    o.material.opacity = k * u.opacity;
  }

  clear() {
    this.n = 0;
    this.mesh.count = 0;
    for (const o of this.rings) o.visible = false;
    for (const o of this.flashes) o.visible = false;
    this.pillar.visible = false;
    while (this.texts.length) this._removeText(this.texts.length - 1);
  }
}
