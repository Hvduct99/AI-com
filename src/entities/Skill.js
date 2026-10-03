// ============================================================
// Skill.js — Đạn chiêu bay trên sàn đấu.
// Mỗi lần bắn tạo 1 Projectile. Va chạm xử lý ở CombatSystem.
// Mesh dùng geometry/material chung (AssetLoader) => không cần dispose.
// ============================================================
import * as THREE from 'three';
import { AssetBuilders } from '../utils/AssetLoader.js';

let PID = 0;
const MAX_ULTI_SCALE = 1.8;
export const SHOT_Y = 1.7; // tầm bay của đạn (ngang ngực)

export class Projectile {
  constructor(scene, owner, skill, origin, dir) {
    this.id = ++PID;
    this.scene = scene;
    this.owner = owner;       // Character bắn
    this.skill = skill;       // skill def (có thể bị thay bằng bản copy yếu đi)
    this.dir = dir;           // 1 | -1
    this.alive = true;
    this.life = 4.5;
    this.baseRadius = skill.size + 0.25;
    this.radius = this.baseRadius;
    this.hitTargets = new Set(); // mỗi đạn chỉ trúng 1 người tối đa 1 lần

    this.mesh = AssetBuilders.ProjectileBuilder(skill, skill.element);
    this.mesh.position.copy(origin);
    this.mesh.rotation.y = dir > 0 ? 0 : Math.PI; // mesh dựng hướng +X
    this.baseY = origin.y;
    scene.add(this.mesh);
    this.t = 0;
    this.traveled = 0;
    this.grow = skill.isUltimate && !skill.melee ? 0.35 : 0; // tuyệt chiêu to dần (có giới hạn)
  }

  update(dt) {
    if (!this.alive) return;
    this.life -= dt;
    if (this.life <= 0) { this.kill(); return; }
    this.t += dt;
    const step = this.skill.speed * dt;
    this.mesh.position.x += this.dir * step;
    this.traveled += step;
    // Chém cận chiến: hết tầm thì tan
    if (this.skill.range > 0 && this.traveled >= this.skill.range) { this.kill(); return; }
    // Bắn lúc đang nhảy: đạn chúc dần xuống tầm ngực
    if (this.baseY > SHOT_Y) this.baseY = Math.max(SHOT_Y, this.baseY - dt * 7);
    this.mesh.position.y = this.baseY + Math.sin(this.t * 10) * 0.05;
    this.mesh.userData.animate?.(dt, this.t);
    if (this.grow > 0) {
      const s = Math.min(MAX_ULTI_SCALE, 1 + this.t * this.grow);
      this.mesh.scale.setScalar(s);
      this.radius = this.baseRadius * s;
    }
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.remove(this.mesh);
  }
}

export function castSkill(scene, caster, skillIndex, projectiles) {
  const skill = caster.def.skills[skillIndex];
  if (!skill || !caster.canCast(skillIndex)) return null;
  caster.spendFor(skillIndex);
  const dir = caster.facing;
  if (skill.dash) caster.applyKnockback(dir, skill.dash); // lao tới theo nhát chém
  const origin = caster.pos.clone().add(new THREE.Vector3(dir * (skill.melee ? 0.6 : 1.0), SHOT_Y, 0));
  const p = new Projectile(scene, caster, skill, origin, dir);
  projectiles.push(p);
  return p;
}
