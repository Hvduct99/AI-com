// ============================================================
// CombatSystem — va chạm & sát thương.
//  - đạn vs nhân vật (trừ chính chủ, mỗi đạn trúng 1 người tối đa 1 lần)
//  - đạn vs đạn (triệt tiêu, tuyệt chiêu xuyên phá)
//  - Đỡ: giảm sát thương, đỡ đúng lúc = HOÀN HẢO (0 sát thương + hoàn năng lượng)
//  - knockback + năng lượng + khắc hệ ngũ hành
// ============================================================
import * as THREE from 'three';
import { getElementMultiplier, ELEMENTS } from '../config/elements.js';
import { BLOCK, ENERGY } from '../config/characters.js';

const _up = new THREE.Vector3(0, 0.7, 0);
const BODY_CENTER = 1.6; // tâm thân người tính từ chân
const BODY_HALF = 1.3;   // nửa chiều cao vùng trúng đòn

export class CombatSystem {
  constructor({ onHit } = {}) {
    this.onHit = onHit; // (info) => Game: rung camera, âm thanh...
  }

  update(projectiles, fighters, fx) {
    // 1. Đạn vs đạn
    for (let i = 0; i < projectiles.length; i++) {
      const a = projectiles[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < projectiles.length; j++) {
        const b = projectiles[j];
        if (!b.alive || a.owner === b.owner) continue;
        if (a.mesh.position.distanceTo(b.mesh.position) < a.radius + b.radius) {
          this._clash(a, b, fx);
          if (!a.alive) break;
        }
      }
    }

    // 2. Đạn vs người (sàn 2D: xét trục x + độ cao để nhảy né được)
    for (const p of projectiles) {
      if (!p.alive) continue;
      for (const f of fighters) {
        if (f === p.owner || !f.alive || p.hitTargets.has(f)) continue;
        if (Math.abs(p.mesh.position.y - (f.pos.y + BODY_CENTER)) > p.radius + BODY_HALF) continue;
        // Khiên đứng trước người nên chạm sớm hơn thân một chút
        const reach = p.radius + 0.55 + (f.blocking ? 0.5 : 0);
        if (Math.abs(p.mesh.position.x - f.pos.x) < reach) {
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
      const [ult, weak] = a.skill.isUltimate ? [a, b] : [b, a];
      weak.kill();
      ult.skill = { ...ult.skill, damage: ult.skill.damage * 0.7 };
      fx.impact(mid, ult.skill.element, true);
      fx.hitText(mid, 'PHÁ!', '#ffd700', false);
      type = 'break';
    } else {
      a.kill(); b.kill();
      fx.impact(mid, a.skill.element, false);
      fx.impact(mid, b.skill.element, false);
      fx.hitText(mid, 'TRIỆT TIÊU!', '#ffffff', false);
    }
    this.onHit?.({ type, pos: mid });
  }

  _hitFighter(p, target, fx) {
    const atk = p.owner;
    const big = p.skill.isUltimate;
    const { mult, counter, resisted } = getElementMultiplier(atk.element, target.element);
    p.hitTargets.add(target);
    const hitPos = p.mesh.position.clone();

    // --- Đỡ ---
    if (target.blocking) {
      const perfect = target.blockAge <= BLOCK.perfectWindow;
      const chip = perfect ? 0 : (big ? BLOCK.ultChip : BLOCK.chip);
      const dmg = Math.round(p.skill.damage * mult * chip);
      if (dmg > 0) target.takeDamage(dmg, true, false);
      target.applyKnockback(p.dir, perfect ? 0.5 : (big ? 4 : 1.2));
      if (perfect) target.healEnergy(BLOCK.perfectRefund);
      atk.healEnergy((p.skill.energyGain || 0) * 0.3);
      fx.shieldHit(hitPos, target.element, perfect);
      fx.hitText(hitPos.clone().add(_up), perfect ? 'ĐỠ HOÀN HẢO!' : 'ĐỠ!', perfect ? '#7dffb0' : '#bde0ff', perfect);
      if (dmg > 0) fx.hitText(hitPos, `-${dmg}`, '#cfd8dc', false);
      // Đạn thường bị chặn; tuyệt chiêu xuyên khiên nhưng yếu hẳn
      if (big) p.skill = { ...p.skill, damage: p.skill.damage * 0.4 };
      else p.kill();
      this.onHit?.({ type: 'block', perfect, target, damage: dmg, pos: hitPos });
      return;
    }

    const dmg = Math.max(1, Math.round(p.skill.damage * mult));
    target.takeDamage(dmg, true, true);
    target.applyKnockback(p.dir, big ? 9 : 2.5 + p.skill.damage * 0.18);
    // Năng lượng: người đánh hồi, người bị đánh cũng hồi chút để lật kèo
    atk.healEnergy(p.skill.energyGain || 0);
    target.healEnergy(ENERGY.hitTaken);

    fx.impact(hitPos, atk.element, big);
    fx.hitText(hitPos, `-${dmg}`, counter ? '#ffd700' : '#ffffff', big || counter);
    if (counter) fx.hitText(hitPos.clone().add(_up), 'KHẮC CHẾ!', '#ff5252', false);
    else if (resisted) fx.hitText(hitPos.clone().add(_up), 'BỊ KHẮC...', '#90caf9', false);

    // Tuyệt chiêu xuyên qua người (bay tiếp, yếu dần); đạn thường nổ luôn
    if (big) p.skill = { ...p.skill, damage: p.skill.damage * 0.55 };
    else p.kill();

    this.onHit?.({ type: 'hit', attacker: atk, target, damage: dmg, counter, ultimate: big, pos: hitPos, color: ELEMENTS[atk.element].color });
  }
}
