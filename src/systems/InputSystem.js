// ============================================================
// InputSystem — gom phím 2 người chơi.
// P1: A/D di chuyển, Q/W/E/R skill 1-4
// P2: ←/→ di chuyển, U/I/O/P skill 1-4
// Dùng e.code (vị trí phím vật lý) => không bị Unikey/Telex,
// CapsLock hay layout bàn phím làm hỏng điều khiển.
// Chế độ 1 người (đấu máy): phím của P2 cũng điều khiển P1.
// Nút cảm ứng gọi press()/release() với cùng mã phím.
// ============================================================

const P1_MOVE = { KeyA: -1, KeyD: 1 };
const P2_MOVE = { ArrowLeft: -1, ArrowRight: 1 };
const P1_SKILLS = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };
const P2_SKILLS = { KeyU: 0, KeyI: 1, KeyO: 2, KeyP: 3 };
const GAME_KEYS = new Set([
  ...Object.keys(P1_MOVE), ...Object.keys(P2_MOVE),
  ...Object.keys(P1_SKILLS), ...Object.keys(P2_SKILLS),
  'Space', 'ArrowUp', 'ArrowDown',
]);

export class InputSystem {
  constructor() {
    this.keys = new Set();
    this.skillQueue = []; // [{player:1|2, index:0..3}]
    this.enabled = false;
    this.singlePlayer = false;
    this.onPause = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  _onKeyDown(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'Escape') { this.onPause?.(); return; }
    if (!this.enabled) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.press(e.code);
  }

  _onKeyUp(e) {
    this.release(e.code);
  }

  press(code) {
    if (!this.enabled) return;
    this.keys.add(code);
    if (code in P1_SKILLS) this.skillQueue.push({ player: 1, index: P1_SKILLS[code] });
    else if (code in P2_SKILLS) {
      this.skillQueue.push({ player: this.singlePlayer ? 1 : 2, index: P2_SKILLS[code] });
    }
  }

  release(code) {
    this.keys.delete(code);
  }

  _axis(map) {
    let v = 0;
    for (const code in map) if (this.keys.has(code)) v += map[code];
    return v;
  }

  /** -1 | 0 | 1 trục di chuyển của player */
  moveAxis(player) {
    if (!this.enabled) return 0;
    if (player === 1) {
      const v = this._axis(P1_MOVE) + (this.singlePlayer ? this._axis(P2_MOVE) : 0);
      return Math.max(-1, Math.min(1, v));
    }
    return this.singlePlayer ? 0 : this._axis(P2_MOVE);
  }

  /** Cho AI bấm skill qua cùng đường với người chơi */
  queueSkill(player, index) {
    if (this.enabled) this.skillQueue.push({ player, index });
  }

  drainSkillQueue() {
    const q = this.skillQueue;
    this.skillQueue = [];
    return q;
  }

  reset() {
    this.keys.clear();
    this.skillQueue = [];
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
