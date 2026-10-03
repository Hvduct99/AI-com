// ============================================================
// CombatSystem — va chạm & sát thương.
//  - đạn vs nhân vật (trừ chính chủ, mỗi đạn trúng 1 người tối đa 1 lần)
//  - đạn vs đạn (triệt tiêu, ultimate xuyên phá)
//  - knockback + năng lượng + khắc hệ ngũ hành
// ============================================================
import * as THREE from 'three';
import { getElementMultiplier, ELEMENTS } from '../config/elements.js';

const _up = new THREE.Vector3(0, 0.7, 0);

export class CombatSystem {
  constructor({ onHit } = {}) {
    this.onHit = onHit; // (info) => Game: rung camera, âm thanh...
  }

  /**
   * @param {Projectile[]} projectiles
   * @param {Character[]} fighters
   * @param {EffectSystem} fx
   */
  update(projectiles, fighters, fx) {
    // 1. Đạn vs đạn (skill va chạm nhau trên không)
    for (let i = 0; i < projectiles.length; i++) {
      const a = projectiles[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < projectiles.length; j++) {
        const b = projectiles[j];
        if (!b.alive || a.owner === b.owner) continue;
        const dist = a.mesh.position.distanceTo(b.mesh.position);
        if (dist < a.radius + b.radius) {
          this._clash(a, b, fx);
          if (!a.alive) break;
        }
      }
    }

    // 2. Đạn vs người (chỉ xét trục x — sàn đấu 2D trong không gian 3D)
    for (const p of projectiles) {
      if (!p.alive) continue;
      for (const f of fighters) {
        if (f === p.owner || !f.alive || p.hitTargets.has(f)) continue;
        if (Math.abs(p.mesh.position.x - f.pos.x) < p.radius + 0.55) {
          this._hitFighter(p, f, fx);
          if (!p.alive) break;
        }
      }
    }
  }

  _clash(a, b, fx) {
    const mid = a.mesh.position.clone().add(b.mesh.position).multiplyScalar(0.5);
    let type = 'clash';
    if (a.skill.isUltimate !== b.skill.isUltimate) {
      // Ultimate phá đạn thường và bay tiếp (yếu đi 30%)
      const [ult, weak] = a.skill.isUltimate ? [a, b] : [b, a];
      weak.kill();
      ult.skill = { ...ult.skill, damage: ult.skill.damage * 0.7 };
      fx.burst(mid, 0xffffff, 22, 6, 3);
      fx.hitText(mid, 'PHÁ!', '#ffd700', false);
      type = 'break';
    } else {
      a.kill(); b.kill();
      fx.burst(mid, 0xfff176, 26, 7, 3);
      fx.hitText(mid, 'ĐỠ!', '#ffffff', false);
    }
    this.onHit?.({ type, pos: mid });
  }

  _hitFighter(p, target, fx) {
    const atk = p.owner;
    const { mult, counter, resisted } = getElementMultiplier(atk.element, target.element);
    const dmg = Math.max(1, Math.round(p.skill.damage * mult));

    p.hitTargets.add(target);
    target.takeDamage(dmg);
    const force = p.skill.isUltimate ? 9 : 2.5 + p.skill.damage * 0.18;
    target.applyKnockback(p.dir, force);

    // Năng lượng: người đánh hồi, người bị đánh cũng hồi chút để lật kèo
    atk.healEnergy(p.skill.energyGain || 0);
    target.healEnergy(6);

    const hitPos = p.mesh.position.clone();
    const big = p.skill.isUltimate;
    fx.burst(hitPos, ELEMENTS[atk.element].color, big ? 46 : 18, big ? 9 : 5, 3);
    fx.hitText(hitPos, `-${dmg}`, counter ? '#ffd700' : '#ffffff', big || counter);
    if (counter) fx.hitText(hitPos.clone().add(_up), 'KHẮC CHẾ!', '#ff5252', false);
    else if (resisted) fx.hitText(hitPos.clone().add(_up), 'BỊ KHẮC...', '#90caf9', false);

    // Ultimate xuyên qua người (bay tiếp, yếu dần); đạn thường nổ luôn
    if (big) p.skill = { ...p.skill, damage: p.skill.damage * 0.55 };
    else p.kill();

    this.onHit?.({ type: 'hit', attacker: atk, target, damage: dmg, counter, ultimate: big, pos: hitPos });
  }
}
