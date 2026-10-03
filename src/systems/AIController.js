// ============================================================
// AIController — điều khiển P2 khi chơi đấu máy.
// Giữ khoảng cách, tránh biên, bắn đỡ đạn, xả ultimate khi đầy nộ.
// ============================================================
import { HALF_BOUND, EDGE_MARGIN } from '../entities/Arena.js';

const LEVELS = {
  easy:   { think: 0.9,  block: 0.15, aggro: 0.45, jitter: 0.6 },
  normal: { think: 0.55, block: 0.45, aggro: 0.65, jitter: 0.35 },
  hard:   { think: 0.28, block: 0.8,  aggro: 0.85, jitter: 0.15 },
};

export class AIController {
  constructor(level = 'normal') {
    this.p = LEVELS[level] ?? LEVELS.normal;
    this.axis = 0;
    this.moveT = 0;
    this.thinkT = 0.8;
    this.seen = new Set();
    this.preferDist = 5.5;
  }

  /**
   * @returns {number[]} danh sách index skill muốn bấm frame này
   */
  update(dt, me, foe, projectiles) {
    const out = [];
    if (!me.alive || !foe.alive) { this.axis = 0; return out; }
    const dx = foe.pos.x - me.pos.x;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx) || 1;

    // --- Di chuyển ---
    this.moveT -= dt;
    if (this.moveT <= 0) {
      this.moveT = 0.35 + Math.random() * 0.6;
      this.preferDist = 4.5 + Math.random() * 3;
      if (dist > this.preferDist + 1) this.axis = toward;
      else if (dist < this.preferDist - 1.5) this.axis = -toward;
      else this.axis = Math.random() < this.p.jitter ? (Math.random() < 0.5 ? -1 : 1) : 0;
    }
    // Tránh vùng biên: luôn ưu tiên quay về giữa
    const safe = HALF_BOUND - EDGE_MARGIN - 0.8;
    if (me.pos.x > safe) this.axis = -1;
    else if (me.pos.x < -safe) this.axis = 1;

    // --- Đỡ đạn: bắn skill rẻ nhất để triệt tiêu đạn đang lao tới ---
    for (const pr of projectiles) {
      if (!pr.alive || pr.owner === me || this.seen.has(pr.id)) continue;
      const rel = me.pos.x - pr.mesh.position.x;
      if (Math.sign(rel) !== pr.dir) continue; // đạn đang bay ra xa
      if (Math.abs(rel) > 5) continue;
      this.seen.add(pr.id);
      if (Math.random() > this.p.block) continue;
      const idx = pr.skill.isUltimate ? (me.canCast(3) ? 3 : -1) : [0, 1, 2].find((i) => me.canCast(i));
      if (idx !== undefined && idx >= 0) out.push(idx);
    }
    if (this.seen.size > 200) this.seen.clear();

    // --- Tấn công ---
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.p.think * (0.6 + Math.random() * 0.8);
      if (me.canCast(3)) out.push(3);
      else if (Math.random() < this.p.aggro) {
        const ready = [2, 1, 0].filter((i) => me.canCast(i));
        if (ready.length) out.push(ready[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * ready.length)]);
      }
    }
    return out;
  }
}
