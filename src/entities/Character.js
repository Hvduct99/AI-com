// ============================================================
// Character — 1 võ sĩ trên sàn đấu.
// Constructor nhận characterDef (config/characters.js).
// Muốn đổi model: sửa AssetBuilders.CharacterBuilder.
// ============================================================
import * as THREE from 'three';
import { ELEMENTS } from '../config/elements.js';

let UID = 0;
const RED = new THREE.Color(0xff2222);

function disposeObject(root) {
  root.traverse((o) => {
    // Geometry của model GLB dùng chung giữa các bản clone -> không dispose
    if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { m.map?.dispose(); m.dispose(); }
  });
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Character {
  constructor(scene, def, side = 1) {
    this.uid = ++UID;
    this.def = def;
    this.side = side; // 1 = trái (nhìn phải), -1 = phải (nhìn trái)
    this.element = def.element;
    this.maxHp = def.maxHp;
    this.hp = def.maxHp;
    this.energy = 20;
    this.moveSpeed = def.moveSpeed;
    this.alive = true;

    this.cooldowns = [0, 0, 0, 0];
    this.flash = 0;      // thời gian nhấp nháy khi trúng đòn
    this.attackAnim = 0;
    this.edgeTick = 0;
    this.edgeWarnCd = 0;
    this.knockVel = 0;   // vận tốc đẩy lùi
    this.moveInput = 0;
    this.deadT = 0;
    this.celebrating = false;

    this.mesh = new THREE.Group();
    this.facing = side;
    this.pos = new THREE.Vector3(side > 0 ? -4 : 4, 0, 0);
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);

    this.label = this._makeLabel(def);
    this.label.position.y = 4.3;
    this.mesh.add(this.label);
  }

  setMesh(model) {
    if (this.bodyRoot) {
      this.mesh.remove(this.bodyRoot);
      disposeObject(this.bodyRoot);
    }
    this.mixer?.stopAllAction();
    this.bodyRoot = model;
    this.mesh.add(model);
    this.label.position.y = (model.userData.height ?? 3.5) + 0.8;
    this.yaw = this.facing > 0 ? (model.userData.yawRight ?? 0) : (model.userData.yawLeft ?? 0);
    model.rotation.y = this.yaw;

    // Gom material có emissive để nháy đỏ khi trúng đòn
    this.flashMats = [];
    const seen = new Set();
    model.traverse((o) => {
      const m = o.material;
      if (o.isMesh && m && m.emissive && !seen.has(m)) {
        seen.add(m);
        this.flashMats.push({ m, color: m.emissive.clone(), intensity: m.emissiveIntensity });
      }
    });
    this._flashOn = false;

    // Animation (nếu model có clip)
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.oneShotT = 0;
    const clips = model.userData.clips;
    if (clips && clips.length) {
      this.mixer = new THREE.AnimationMixer(model.userData.animRoot ?? model);
      for (const clip of clips) this.actions[clip.name] = this.mixer.clipAction(clip);
      this._play('Idle', { fade: 0 });
    }
  }

  _play(name, { once = false, timeScale = 1, fade = 0.18 } = {}) {
    const next = this.actions[name];
    if (!next) return 0;
    if (next === this.current && !once) {
      next.setEffectiveTimeScale(timeScale);
      return 0;
    }
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    if (this.current && this.current !== next && fade > 0) {
      this.current.fadeOut(fade);
      next.fadeIn(fade);
    } else if (this.current && this.current !== next) {
      this.current.stop();
    }
    next.play();
    this.current = next;
    return next.getClip().duration / Math.abs(timeScale);
  }

  _makeLabel(def) {
    const el = ELEMENTS[def.element];
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(8, 6, 240, 52, 14) : ctx.rect(8, 6, 240, 52);
    ctx.fill();
    ctx.font = 'bold 28px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = el.css;
    ctx.fillText(`${def.icon} ${def.name}`, 128, 42);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(2.2, 0.55, 1);
    sp.renderOrder = 5;
    return sp;
  }

  get x() { return this.pos.x; }

  canCast(i) {
    if (!this.alive) return false;
    if (this.cooldowns[i] > 0) return false;
    const sk = this.def.skills[i];
    if (sk.isUltimate && this.energy < 100) return false;
    return true;
  }

  spendFor(i) {
    const sk = this.def.skills[i];
    this.cooldowns[i] = sk.cooldown;
    if (sk.isUltimate) this.energy = 0;
    this.attackAnim = 0.35;
    if (this.mixer) {
      const d = this._play('Punch', { once: true, timeScale: sk.isUltimate ? 1.3 : 2.2, fade: 0.08 });
      this.oneShotT = Math.max(0.2, d - 0.15);
    }
  }

  takeDamage(amount, flash = true) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (flash) this.flash = 0.25;
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.knockVel *= 0.5;
    if (this.mixer) this._play('Death', { once: true, fade: 0.1 });
  }

  celebrate() {
    if (!this.alive || this.celebrating) return;
    this.celebrating = true;
    this.moveInput = 0;
    if (this.mixer) this._play(this.actions.Dance ? 'Dance' : 'Wave', { fade: 0.3 });
  }

  healEnergy(v) {
    this.energy = Math.min(100, this.energy + v);
  }

  applyKnockback(dir, force) {
    this.knockVel += dir * force;
  }

  /** Di chuyển + vật lý đẩy lùi, kẹp trong biên. */
  integrate(dt, moveInput, halfBound) {
    this.moveInput = this.alive ? moveInput : 0;
    const target = this.moveInput * this.moveSpeed;
    this.knockVel *= Math.pow(0.02, dt);
    if (Math.abs(this.knockVel) < 0.01) this.knockVel = 0;
    this.pos.x += (target + this.knockVel) * dt;
    this.pos.x = Math.max(-halfBound, Math.min(halfBound, this.pos.x));
  }

  update(dt) {
    for (let i = 0; i < 4; i++) {
      if (this.cooldowns[i] > 0) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    }
    if (this.flash > 0) this.flash -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;
    if (this.edgeWarnCd > 0) this.edgeWarnCd -= dt;

    this.mesh.position.copy(this.pos);
    if (!this.bodyRoot) return;
    const ud = this.bodyRoot.userData;

    // Xoay mượt về phía đối thủ
    if (this.alive && !this.celebrating) {
      const targetYaw = this.facing > 0 ? (ud.yawRight ?? 0) : (ud.yawLeft ?? 0);
      this.yaw += wrapAngle(targetYaw - this.yaw) * Math.min(1, dt * 12);
      this.bodyRoot.rotation.y = this.yaw;
    } else if (this.celebrating) {
      this.yaw += wrapAngle(0 - this.yaw) * Math.min(1, dt * 4);
      this.bodyRoot.rotation.y = this.yaw;
    }

    // Nháy đỏ khi trúng đòn (chỉ ghi khi đổi trạng thái)
    const flashing = this.flash > 0 && Math.floor(this.flash * 20) % 2 === 0;
    if (flashing !== this._flashOn) {
      this._flashOn = flashing;
      for (const f of this.flashMats) {
        if (flashing) { f.m.emissive.copy(RED); f.m.emissiveIntensity = 1.2; }
        else { f.m.emissive.copy(f.color); f.m.emissiveIntensity = f.intensity; }
      }
    }

    if (this.mixer) {
      if (this.oneShotT > 0) this.oneShotT -= dt;
      if (this.alive && !this.celebrating && this.oneShotT <= 0) {
        if (this.moveInput !== 0) {
          const forward = this.moveInput * this.facing > 0;
          this._play('Walking', { timeScale: forward ? 1.5 : -1.2 });
        } else {
          this._play('Idle');
        }
      }
      this.mixer.update(dt);
    } else {
      // Fallback procedural: nhún nhảy + giơ tay + ngã khi chết
      const t = performance.now() * 0.003;
      this.bodyRoot.position.y = this.alive ? Math.abs(Math.sin(t + this.uid)) * 0.07 : 0;
      if (ud.ring) ud.ring.rotation.z += dt * 2;
      if (ud.armR) ud.armR.rotation.x = this.attackAnim > 0 ? -1.4 : 0;
      if (!this.alive) {
        this.deadT += dt;
        this.bodyRoot.rotation.z = -Math.min(Math.PI / 2, this.deadT * 4) * this.facing;
        this.mesh.position.y = -Math.min(0.4, this.deadT * 0.6);
      }
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mixer?.stopAllAction();
    if (this.bodyRoot) disposeObject(this.bodyRoot);
    this.label.material.map.dispose();
    this.label.material.dispose();
  }
}
