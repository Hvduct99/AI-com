// ============================================================
// AIController — điều khiển P2 khi chơi đấu máy.
// Tầm xa: giữ khoảng cách. Cận chiến: áp sát rồi chém.
// Phòng thủ: Đỡ đúng lúc / nhảy né / bắn triệt tiêu đạn đang lao tới.
// ============================================================
import { HALF_BOUND, EDGE_MARGIN } from '../entities/Arena.js';
import { BLOCK, ENERGY } from '../config/characters.js';
import { BLOCK_INDEX, JUMP_INDEX } from './InputSystem.js';

// lead: giơ khiên trước khi trúng bao nhiêu giây (< 0.18s = đỡ hoàn hảo)
const LEVELS = {
  easy:   { think: 0.9,  defend: 0.2,  blockPref: 0.3, jumpPref: 0.25, lead: [0.12, 0.45], aggro: 0.45, jitter: 0.6 },
  normal: { think: 0.55, defend: 0.5,  blockPref: 0.45, jumpPref: 0.3, lead: [0.08, 0.35], aggro: 0.65, jitter: 0.35 },
  hard:   { think: 0.28, defend: 0.85, blockPref: 0.5, jumpPref: 0.35, lead: [0.04, 0.26], aggro: 0.85, jitter: 0.15 },
};

export class AIController {
  constructor(level = 'normal') {
    this.p = LEVELS[level] ?? LEVELS.normal;
    this.axis = 0;
    this.moveT = 0;
    this.thinkT = 0.8;
    this.decided = new Map(); // projectile id -> 'block' | 'jump' | 'shoot' | 'ignore' | 'done'
    this.lead = new Map();    // projectile id -> phản ứng trước bao nhiêu giây
    this.preferDist = 5.5;
  }

  /** @returns {number[]} danh sách index muốn bấm frame này (-1 = Đỡ, -2 = Nhảy) */
  update(dt, me, foe, projectiles) {
    const out = [];
    if (!me.alive || !foe.alive) { this.axis = 0; return out; }
    const melee = me.def.style === 'melee';
    const dx = foe.pos.x - me.pos.x;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx) || 1;
    const reach = melee ? me.def.skills[0].range + 1.2 : 99;

    // --- Di chuyển ---
    this.moveT -= dt;
    if (this.moveT <= 0) {
      this.moveT = 0.35 + Math.random() * 0.6;
      this.preferDist = melee ? 1.6 + Math.random() * 1.2 : 4.5 + Math.random() * 3;
      if (dist > this.preferDist + 1) this.axis = toward;
      else if (dist < this.preferDist - 1.5) this.axis = -toward;
      else this.axis = Math.random() < this.p.jitter ? (Math.random() < 0.5 ? -1 : 1) : 0;
    }
    if (melee && dist > reach) this.axis = toward; // cận chiến: luôn áp sát
    const safe = HALF_BOUND - EDGE_MARGIN - 0.8;
    if (me.pos.x > safe) this.axis = -1;
    else if (me.pos.x < -safe) this.axis = 1;

    // --- Phòng thủ ---
    for (const pr of projectiles) {
      if (!pr.alive || pr.owner === me) continue;
      const rel = me.pos.x - pr.mesh.position.x;
      if (Math.sign(rel) !== pr.dir) continue; // đạn đang bay ra xa
      const gap = Math.abs(rel) - pr.radius - 0.55;
      const eta = gap / Math.max(1, pr.skill.speed);
      let plan = this.decided.get(pr.id);
      if (!plan) {
        if (Math.abs(rel) > 6) continue;
        const big = pr.skill.isUltimate;
        if (Math.random() > this.p.defend) plan = 'ignore';
        else if (!big && !pr.skill.melee && Math.random() < this.p.jumpPref) plan = 'jump';
        else if ((big || Math.random() < this.p.blockPref) && me.energy >= BLOCK.energyCost + 5) plan = 'block';
        else plan = 'shoot';
        this.decided.set(pr.id, plan);
        const [a, b] = this.p.lead;
        this.lead.set(pr.id, a + Math.random() * (b - a));
        if (plan === 'shoot') {
          const idx = big ? (me.canCast(3) ? 3 : -9) : [0, 1, 2].find((i) => me.canCast(i));
          if (idx !== undefined && idx >= 0) out.push(idx);
          else this.decided.set(pr.id, 'block');
        }
      }
      plan = this.decided.get(pr.id);
      const lead = this.lead.get(pr.id) ?? 0.15;
      // Giơ khiên ngay trước khi trúng để có cơ hội ĐỠ HOÀN HẢO
      if (plan === 'block' && eta < lead && !me.blocking && me.canBlock()) {
        out.push(BLOCK_INDEX);
        this.decided.set(pr.id, 'done');
      }
      // Nhảy sớm hơn một chút để lên tới đỉnh đúng lúc đạn qua
      if (plan === 'jump' && eta < lead + 0.2 && me.canJump()) {
        out.push(JUMP_INDEX);
        this.decided.set(pr.id, 'done');
      }
    }
    if (this.decided.size > 200) { this.decided.clear(); this.lead.clear(); }

    // --- Tấn công ---
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.p.think * (0.6 + Math.random() * 0.8) * (melee ? 0.7 : 1);
      const ult = me.def.skills[3];
      const inReach = (sk) => !sk.melee || dist < sk.range + 1.2 + (sk.dash ? 3 : 0);
      if (me.energy >= ENERGY.ultCost && me.canCast(3) && inReach(ult)) out.push(3);
      else if (Math.random() < this.p.aggro) {
        const ready = [2, 1, 0].filter((i) => me.canCast(i) && inReach(me.def.skills[i]));
        if (ready.length) out.push(ready[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * ready.length)]);
      }
      // Thỉnh thoảng nhảy áp sát (cận chiến) cho khó đoán
      if (melee && dist > 3 && dist < 6 && Math.random() < 0.15 && me.canJump()) out.push(JUMP_INDEX);
    }
    return out;
  }
}
