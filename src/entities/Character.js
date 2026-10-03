// ============================================================
// Character — 1 võ tướng trên sàn đấu.
// Constructor nhận characterDef (config/characters.js).
// Muốn đổi model: sửa AssetBuilders.CharacterBuilder.
// ============================================================
import * as THREE from 'three';
import { ELEMENTS } from '../config/elements.js';
import { BLOCK, ENERGY, JUMP } from '../config/characters.js';
import { AssetBuilders } from '../utils/AssetLoader.js';

let UID = 0;
const RED = new THREE.Color(0xff2222);

function disposeObject(root) {
  root.traverse((o) => {
    // Geometry của model GLB dùng chung giữa các bản clone -> không dispose
    if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
    // Mỗi bản clone có skeleton riêng; boneTexture của nó nằm trên GPU
    if (o.isSkinnedMesh) o.skeleton?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.map && !m.map.userData.shared) m.map.dispose();
      m.dispose();
    }
  });
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Vai trò animation -> tên clip ưu tiên (model khác nhau có bộ clip khác nhau)
const ANIM_ROLES = {
  idle: ['Idle_Attacking', 'Idle_Weapon', 'Attack_Idle', 'Attacking_Idle', 'Idle'],
  walk: ['Walk', 'Walking'],
  light: ['Sword_AttackFast', 'Dagger_Attack', 'Attack', 'Staff_Attack', 'Bow_Attack_Shoot', 'Spell1', 'Punch'],
  heavy: ['Sword_Attack', 'Dagger_Attack2', 'Attack2', 'Spell2', 'Staff_Attack', 'Bow_Attack_Shoot', 'Punch'],
  ult: ['Spell2', 'Sword_Attack', 'Attack2', 'Dagger_Attack2', 'Staff_Attack', 'Bow_Attack_Shoot', 'Punch'],
  jump: ['JumpFlip', 'Jump', 'Roll'],
  hit: ['RecieveHit', 'RecieveHit_Attacking'],
  block: ['RecieveHit_Attacking', 'Idle_Attacking', 'Idle'],
  death: ['Death'],
  win: ['Spell1', 'Wave', 'Dance', 'Idle'],
};

export class Character {
  constructor(scene, def, side = 1) {
    this.uid = ++UID;
    this.def = def;
    this.side = side; // 1 = trái (nhìn phải), -1 = phải (nhìn trái)
    this.element = def.element;
    this.maxHp = def.maxHp;
    this.hp = def.maxHp;
    this.energy = ENERGY.start;
    this.velY = 0;          // vận tốc rơi/nhảy
    this.landed = false;    // true đúng 1 frame khi chạm đất (Game làm bụi)
    this.moveSpeed = def.moveSpeed;
    this.dmgMul = 1;   // hệ số sát thương (tướng địch ở Chinh Phạt mạnh dần)
    this.alive = true;

    this.cooldowns = [0, 0, 0, 0];
    this.blockCd = 0;
    this.blockT = 0;     // > 0: đang giơ khiên
    this.blockAge = 0;   // thời gian kể từ lúc giơ khiên (để tính đỡ hoàn hảo)
    this.flash = 0;
    this.attackAnim = 0;
    this.edgeTick = 0;
    this.edgeWarnCd = 0;
    this.knockVel = 0;
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

    this.shield = AssetBuilders.ShieldBuilder(def.element);
    this.mesh.add(this.shield);
  }

  setMesh(model) {
    if (this.bodyRoot) {
      this.mesh.remove(this.bodyRoot);
      disposeObject(this.bodyRoot);
    }
    this.mixer?.stopAllAction();
    this.bodyRoot = model;
    this.mesh.add(model);
    this.label.position.y = (model.userData.height ?? 3.5) + 0.9;
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

    this.mixer = null;
    this.actions = {};
    this.anim = {};
    this.current = null;
    this.oneShotT = 0;
    const clips = model.userData.clips;
    if (clips && clips.length) {
      this.mixer = new THREE.AnimationMixer(model.userData.animRoot ?? model);
      for (const clip of clips) this.actions[clip.name] = this.mixer.clipAction(clip);
      for (const [role, names] of Object.entries(ANIM_ROLES)) {
        this.anim[role] = names.find((n) => this.actions[n]) ?? null;
      }
      this._play(this.anim.idle, { fade: 0 });
    }
  }

  _play(name, { once = false, timeScale = 1, fade = 0.18 } = {}) {
    const next = name && this.actions[name];
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

  /** Chơi 1 animation 1 lần, sau đó tự về idle/walk */
  _oneShot(role, timeScale = 1, maxT = 0.9) {
    if (!this.mixer || !this.alive) return;
    const d = this._play(this.anim[role], { once: true, timeScale, fade: 0.08 });
    if (d > 0) this.oneShotT = Math.min(maxT, d * 0.85);
  }

  _makeLabel(def) {
    const el = ELEMENTS[def.element];
    const c = document.createElement('canvas');
    c.width = 320; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(8, 6, 304, 52, 14) : ctx.rect(8, 6, 304, 52);
    ctx.fill();
    ctx.font = 'bold 28px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = el.css;
    ctx.fillText(`${def.icon} ${def.name}`, 160, 42, 290);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(2.6, 0.52, 1);
    sp.renderOrder = 5;
    return sp;
  }

  get x() { return this.pos.x; }
  get blocking() { return this.blockT > 0 && this.alive; }
  get grounded() { return this.pos.y <= 0 && this.velY <= 0; }

  canCast(i) {
    if (!this.alive) return false;
    if (this.cooldowns[i] > 0) return false;
    const sk = this.def.skills[i];
    if (sk.isUltimate && this.energy < ENERGY.ultCost) return false;
    return true;
  }

  canJump() {
    return this.alive && !this.celebrating && this.grounded;
  }

  /** Nhảy (chỉ khi đang đứng trên đất). Trả về true nếu thành công */
  jump() {
    if (!this.canJump()) return false;
    this.velY = JUMP.velocity;
    this.pos.y = 0.001;
    if (this.mixer) {
      const airTime = (2 * JUMP.velocity) / JUMP.gravity;
      const clip = this.actions[this.anim.jump]?.getClip();
      const ts = clip ? clip.duration / airTime : 1;
      this._play(this.anim.jump, { once: true, timeScale: ts, fade: 0.06 });
      this.oneShotT = airTime;
    }
    return true;
  }

  canBlock() {
    return this.alive && this.blockCd <= 0 && this.energy >= BLOCK.energyCost;
  }

  /** Giơ khiên. Trả về true nếu thành công */
  block() {
    if (!this.canBlock()) return false;
    this.energy -= BLOCK.energyCost;
    this.blockCd = BLOCK.cooldown;
    this.blockT = BLOCK.duration;
    this.blockAge = 0;
    if (this.mixer && this.oneShotT <= 0) this._play(this.anim.block, { once: true, timeScale: 0.6, fade: 0.06 });
    this.oneShotT = Math.max(this.oneShotT, 0.3);
    return true;
  }

  spendFor(i) {
    const sk = this.def.skills[i];
    this.cooldowns[i] = sk.cooldown;
    if (sk.isUltimate) this.energy = Math.max(0, this.energy - ENERGY.ultCost);
    this.attackAnim = 0.35;
    this.blockT = 0; // ra chiêu thì hạ khiên
    const role = sk.isUltimate ? 'ult' : i === 0 ? 'light' : 'heavy';
    this._oneShot(role, sk.isUltimate ? 1.2 : 1.8, sk.isUltimate ? 0.9 : 0.55);
  }

  /** @param {boolean} react - có giật người (animation trúng đòn) không */
  takeDamage(amount, flash = true, react = false) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (flash) this.flash = 0.25;
    if (this.hp <= 0) this.die();
    else if (react && this.oneShotT <= 0.1) this._oneShot('hit', 1.6, 0.4);
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.blockT = 0;
    this.knockVel *= 0.5;
    if (this.mixer) this._play(this.anim.death, { once: true, fade: 0.1 });
  }

  celebrate() {
    if (!this.alive || this.celebrating) return;
    this.celebrating = true;
    this.moveInput = 0;
    this.blockT = 0;
    if (this.mixer) this._play(this.anim.win, { fade: 0.3 });
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
    const speed = this.moveSpeed * (this.blocking ? 0.45 : 1);
    this.knockVel *= Math.pow(0.02, dt);
    if (Math.abs(this.knockVel) < 0.01) this.knockVel = 0;
    this.pos.x += (this.moveInput * speed + this.knockVel) * dt;
    this.pos.x = Math.max(-halfBound, Math.min(halfBound, this.pos.x));
    // Trọng lực (chạy cả khi đã chết để rơi xuống đất)
    this.landed = false;
    if (this.pos.y > 0 || this.velY > 0) {
      this.velY -= JUMP.gravity * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.velY = 0;
        this.landed = true;
        if (this.mixer && this.alive && this.current === this.actions[this.anim.jump]) this.oneShotT = 0;
      }
    }
  }

  _updateShield(dt) {
    const sh = this.shield;
    const on = this.blocking;
    if (on) {
      this.blockT -= dt;
      this.blockAge += dt;
    }
    sh.visible = on;
    if (!on) return;
    const k = Math.min(1, this.blockT / 0.15);           // mờ dần khi sắp hết
    const pop = Math.min(1, this.blockAge / 0.08);        // bật ra nhanh
    sh.scale.set(this.facing * (0.6 + pop * 0.4), 0.6 + pop * 0.4, 0.6 + pop * 0.4);
    sh.position.x = this.facing * 0.55;
    const perfect = this.blockAge < BLOCK.perfectWindow;
    const [dome, rim, glow] = sh.userData.mats;
    dome.opacity = (perfect ? 0.6 : 0.35) * k;
    rim.opacity = 0.85 * k;
    glow.opacity = (perfect ? 0.8 : 0.45) * k;
  }

  update(dt) {
    for (let i = 0; i < 4; i++) {
      if (this.cooldowns[i] > 0) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    }
    if (this.blockCd > 0) this.blockCd = Math.max(0, this.blockCd - dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;
    if (this.edgeWarnCd > 0) this.edgeWarnCd -= dt;
    this._updateShield(dt);

    this.mesh.position.copy(this.pos);
    if (!this.bodyRoot) return;
    const ud = this.bodyRoot.userData;
    // Đĩa dưới chân nằm yên trên sàn khi nhảy, nhỏ dần theo độ cao (như bóng đổ)
    if (ud.discs) {
      const k = Math.max(0.45, 1 - this.pos.y * 0.15);
      ud.discs.forEach((d, i) => {
        d.position.y = 0.02 + i * 0.01 - this.pos.y;
        d.scale.setScalar(k);
      });
    }

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
        if (flashing) { f.m.emissive.copy(RED); f.m.emissiveIntensity = 0.9; }
        else { f.m.emissive.copy(f.color); f.m.emissiveIntensity = f.intensity; }
      }
    }

    if (this.mixer) {
      if (this.oneShotT > 0) this.oneShotT -= dt;
      if (this.alive && !this.celebrating && this.oneShotT <= 0) {
        if (this.moveInput !== 0) {
          const forward = this.moveInput * this.facing > 0;
          this._play(this.anim.walk, { timeScale: (forward ? 1.5 : -1.2) * (this.blocking ? 0.5 : 1) });
        } else {
          this._play(this.anim.idle);
        }
      }
      this.mixer.update(dt);
    } else {
      // Fallback procedural: nhún + giơ tay + ngã khi chết
      const t = performance.now() * 0.003;
      this.bodyRoot.position.y = this.alive ? Math.abs(Math.sin(t + this.uid)) * 0.07 : 0;
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
    disposeObject(this.shield);
    this.label.material.map.dispose();
    this.label.material.dispose();
  }
}
