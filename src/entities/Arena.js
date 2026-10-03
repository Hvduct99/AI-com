// ============================================================
// Arena — sàn đấu + 2 biên.
// Luật biên: đứng trong vùng biên -> mất máu nhỏ theo giây + bị đẩy ra.
// ============================================================
import { AssetBuilders } from '../utils/AssetLoader.js';

export const ARENA_WIDTH = 16;          // tổng chiều dài sàn
export const HALF_BOUND = ARENA_WIDTH / 2; // = 8
export const EDGE_MARGIN = 1.15;        // độ rộng vùng biên
export const EDGE_DPS = 8;              // máu mất mỗi giây khi chạm biên
export const EDGE_PUSH = 7;             // lực đẩy ra khỏi biên

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    const built = AssetBuilders.ArenaBuilder(ARENA_WIDTH);
    this.wallL = built.wallL;
    this.wallR = built.wallR;
    this.backdrop = built.backdrop ?? null;
    // Add mọi object builder trả về (sàn, viền, phông nền, đèn...)
    this.objects = [];
    for (const v of Object.values(built)) {
      if (!v || !v.isObject3D) continue;
      this.objects.push(v);
      if (v.isSpotLight && v.target) this.objects.push(v.target);
    }
    scene.add(...this.objects);
    // Chỉ các thanh biên nhấp nháy (vùng cảnh báo giữ opacity riêng)
    this.pulseMats = new Set();
    for (const wall of [this.wallL, this.wallR]) {
      wall?.traverse((m) => { if (m.userData.pulse && m.material) this.pulseMats.add(m.material); });
    }
  }

  /** Áp luật biên cho 1 character. Trả về true nếu đang chạm biên */
  applyEdgeRule(char, dt) {
    const limit = HALF_BOUND - EDGE_MARGIN;
    const over = Math.abs(char.pos.x) - limit;
    if (over > 0 && char.alive) {
      const pushDir = -Math.sign(char.pos.x);
      char.pos.x += pushDir * EDGE_PUSH * dt * Math.min(1.5, 0.5 + over);
      char.takeDamage(EDGE_DPS * dt, false);
      char.edgeTick += dt;
      return true;
    }
    char.edgeTick = 0;
    return false;
  }

  update(dt) {
    this.t += dt;
    const pulse = 0.65 + Math.sin(this.t * 5) * 0.25;
    for (const mat of this.pulseMats) mat.opacity = pulse * 0.9;
    const ud = this.backdrop?.userData;
    ud?.lanterns?.forEach((l, i) => {
      l.rotation.z = Math.sin(this.t * 1.3 + i) * 0.08;
      if (l.userData.glow) l.userData.glow.material.opacity = 0.45 + Math.sin(this.t * 7 + i * 2) * 0.08;
    });
    ud?.banners?.forEach((b, i) => {
      b.userData.cloth.rotation.y = Math.sin(this.t * 1.7 + i) * 0.18;
    });
  }
}
