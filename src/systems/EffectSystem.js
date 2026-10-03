// ============================================================
// EffectSystem — particle nổ + chữ sát thương bay.
// Particle: 1 InstancedMesh (1 draw call, không tạo object mới).
// Chữ: cache texture theo nội dung, chỉ tạo SpriteMaterial nhẹ.
// ============================================================
import * as THREE from 'three';

const MAX_PARTICLES = 700;
const MAX_TEXTS = 40;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _offset = new THREE.Vector3(0, 0.8, 0);

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

    // Dữ liệu particle dạng mảng phẳng (swap-remove khi chết)
    this.n = 0;
    this.px = new Float32Array(MAX_PARTICLES * 3);
    this.pv = new Float32Array(MAX_PARTICLES * 3);
    this.pc = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.size = new Float32Array(MAX_PARTICLES);

    this.texts = [];
    this.texCache = new Map();
  }

  _spawn(x, y, z, vx, vy, vz, colorHex, life, size) {
    if (this.n >= MAX_PARTICLES) return;
    const i = this.n++;
    const i3 = i * 3;
    this.px[i3] = x; this.px[i3 + 1] = y; this.px[i3 + 2] = z;
    this.pv[i3] = vx; this.pv[i3 + 1] = vy; this.pv[i3 + 2] = vz;
    _c.setHex(colorHex);
    this.pc[i3] = _c.r; this.pc[i3 + 1] = _c.g; this.pc[i3 + 2] = _c.b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
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
    this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last]; this.size[i] = this.size[last];
  }

  burst(pos, colorHex, count = 18, speed = 5, up = 2) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.9);
      this._spawn(
        pos.x, pos.y, pos.z,
        Math.cos(a) * s, Math.random() * up + 1, (Math.random() - 0.5) * 3,
        colorHex, 0.4 + Math.random() * 0.5, 1
      );
    }
  }

  trail(pos, colorHex) {
    this._spawn(
      pos.x, pos.y, pos.z,
      Math.random() - 0.5, 0.5, Math.random() - 0.5,
      colorHex, 0.3, 0.7 + Math.random() * 0.6
    );
  }

  ultiFlash(colorHex, x = 0) {
    this.burst(_p.set(x, 1.5, 0), colorHex, 60, 9, 5);
    this.burst(_p.set(x - 3, 1, 0), 0xffffff, 20, 6, 4);
    this.burst(_p.set(x + 3, 1, 0), 0xffffff, 20, 6, 4);
  }

  _textTexture(text, cssColor, big) {
    const key = `${text}|${cssColor}|${big}`;
    let tex = this.texCache.get(key);
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.font = `800 ${big ? 50 : 36}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, 128, 62, 248);
    ctx.fillStyle = cssColor;
    ctx.fillText(text, 128, 62, 248);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (this.texCache.size > 120) {
      // Giới hạn cache: bỏ texture cũ nhất không còn sprite nào dùng
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
    sp.scale.set(big ? 3.2 : 2.2, big ? 1.2 : 0.82, 1);
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
      this.pv[i3 + 1] -= 9 * dt; // trọng lực nhẹ
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

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this._removeText(i); continue; }
      t.sprite.position.y += t.vy * dt;
      t.sprite.material.opacity = Math.min(1, t.life * 2);
    }
  }

  clear() {
    this.n = 0;
    this.mesh.count = 0;
    while (this.texts.length) this._removeText(this.texts.length - 1);
  }
}
