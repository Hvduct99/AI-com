// ============================================================
// HUD — thanh máu/năng lượng + 4 skill slot mỗi bên + đồng hồ.
// Slot ultimate (idx 3) to nhất, khóa khi chưa đủ energy.
// Chỉ ghi DOM khi giá trị đổi (tránh layout thrash mỗi frame).
// ============================================================

import { BLOCK, ENERGY } from '../config/characters.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hp: { 1: $('p1-hp'), 2: $('p2-hp') },
      lag: { 1: $('p1-hp-lag'), 2: $('p2-hp-lag') },
      en: { 1: $('p1-energy'), 2: $('p2-energy') },
      name: { 1: $('p1-name'), 2: $('p2-name') },
      skills: { 1: $('p1-skills'), 2: $('p2-skills') },
      hud: { 1: $('p1-hud'), 2: $('p2-hud') },
      timer: $('timer'),
      center: $('center-text'),
      end: $('end-overlay'),
      winner: $('winner-text'),
      sub: $('winner-sub'),
    };
    this.slots = { 1: [], 2: [] };
    this.blockSlots = { 1: null, 2: null };
    this.cache = {};
    this.flashEl = $('screen-flash');
    // Nút cảm ứng của P1: 'b' = Đỡ, '0'..'3' = chiêu
    this.touch = {};
    document.querySelectorAll('#touch-controls button[data-idx]').forEach((btn) => {
      this.touch[btn.dataset.idx] = { btn, cd: -1, ready: null, charged: null };
    });
  }

  _touch(idx, cd, ready, charged = false) {
    const t = this.touch[idx];
    if (!t) return;
    if (cd !== t.cd) { t.cd = cd; t.btn.style.setProperty('--cd', `${cd}%`); }
    if (ready !== t.ready) { t.ready = ready; t.btn.classList.toggle('locked', !ready); }
    if (charged !== t.charged) { t.charged = charged; t.btn.classList.toggle('charged', charged); }
  }

  /** Chớp màu toàn màn hình (khi ra tuyệt chiêu) */
  flash(css) {
    const el = this.flashEl;
    if (!el) return;
    el.style.background = `radial-gradient(circle at center, transparent 20%, ${css} 120%)`;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  setup(p1def, p2def, p2IsCpu = false) {
    this.el.name[1].textContent = `${p1def.icon} ${p1def.name}`;
    this.el.name[2].textContent = `${p2def.icon} ${p2def.name}${p2IsCpu ? ' (Máy)' : ''}`;
    this.el.end.classList.add('hidden');
    this.cache = {};
    this._buildSlots(1, p1def, ['S', 'Q', 'W', 'E', 'R']);
    this._buildSlots(2, p2def, p2IsCpu ? ['', '', '', '', ''] : ['↓', 'H', 'J', 'K', 'L']);
    this.setTimer(99);
    this.center('');
  }

  _buildSlots(player, def, [blockKey, ...keys]) {
    const bar = this.el.skills[player];
    bar.innerHTML = '';
    const b = document.createElement('div');
    b.className = 'skill-slot block';
    b.dataset.idx = 'b';
    b.title = `Đỡ — tốn ${BLOCK.energyCost} năng lượng, đỡ đúng lúc = HOÀN HẢO`;
    b.innerHTML = `<span class="key">${blockKey}</span><span class="icon">🛡️</span><div class="cd-mask"></div>`;
    bar.appendChild(b);
    this.blockSlots[player] = { root: b, mask: b.querySelector('.cd-mask'), cd: -1, ready: null, on: null };
    this.slots[player] = def.skills.map((sk, i) => {
      const d = document.createElement('div');
      d.className = 'skill-slot' + (sk.isUltimate ? ' ultimate' : '');
      d.dataset.idx = String(i);
      d.title = `${sk.name} — ${sk.damage} sát thương`;
      d.innerHTML = `<span class="key">${keys[i]}</span><span class="icon">${sk.icon}</span><div class="cd-mask"></div>`;
      bar.appendChild(d);
      return { root: d, mask: d.querySelector('.cd-mask'), cd: -1, charged: null, ready: null };
    });
  }

  _set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  update(p1, p2) {
    this._updateFighter(1, p1);
    this._updateFighter(2, p2);
  }

  _updateFighter(player, f) {
    const hpPct = Math.round((f.hp / f.maxHp) * 1000) / 10;
    this._set(`hp${player}`, hpPct, (v) => {
      this.el.hp[player].style.width = `${v}%`;
      this.el.lag[player].style.width = `${v}%`;
      this.el.hud[player].classList.toggle('low', v < 25);
    });
    const en = Math.floor(f.energy);
    this._set(`en${player}`, en, (v) => {
      this.el.en[player].style.width = `${v}%`;
      this.el.en[player].classList.toggle('full', v >= ENERGY.ultCost);
    });
    const bs = this.blockSlots[player];
    if (bs) {
      const cd = Math.ceil((f.blockCd / BLOCK.cooldown) * 10) * 10;
      if (cd !== bs.cd) { bs.cd = cd; bs.mask.style.height = `${cd}%`; }
      const ready = f.canBlock() || f.blocking;
      if (ready !== bs.ready) { bs.ready = ready; bs.root.classList.toggle('locked', !ready); }
      const on = f.blocking;
      if (on !== bs.on) { bs.on = on; bs.root.classList.toggle('active', on); }
      if (player === 1) this._touch('b', cd, ready, on);
    }
    if (player === 1) this._touch('j', 0, f.canJump());
    f.def.skills.forEach((sk, i) => {
      const slot = this.slots[player][i];
      if (!slot) return;
      const cd = sk.cooldown > 0 ? Math.ceil((f.cooldowns[i] / sk.cooldown) * 50) * 2 : 0;
      if (cd !== slot.cd) { slot.cd = cd; slot.mask.style.height = `${cd}%`; }
      const locked = sk.isUltimate && f.energy < ENERGY.ultCost;
      const ready = !locked && f.cooldowns[i] <= 0;
      if (ready !== slot.ready) { slot.ready = ready; slot.root.classList.toggle('locked', !ready); }
      if (sk.isUltimate && ready !== slot.charged) {
        slot.charged = ready;
        slot.root.classList.toggle('charged', ready);
      }
      if (player === 1) this._touch(String(i), cd, ready, sk.isUltimate && ready);
    });
  }

  setTimer(sec) {
    this._set('timer', sec, (v) => {
      this.el.timer.textContent = String(v);
      this.el.timer.classList.toggle('urgent', v <= 10);
    });
  }

  center(text, cls = '') {
    const el = this.el.center;
    if (!text) { el.classList.add('hidden'); this.cache.center = ''; return; }
    if (this.cache.center === text) return;
    this.cache.center = text;
    el.textContent = text;
    el.className = cls;
    // restart animation
    void el.offsetWidth;
    el.classList.add('pop');
  }

  showWinner(text, sub = '') {
    this.el.winner.textContent = text;
    this.el.sub.textContent = sub;
    this.el.end.classList.remove('hidden');
  }

  hideWinner() {
    this.el.end.classList.add('hidden');
  }
}
