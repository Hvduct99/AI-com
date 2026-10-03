// ============================================================
// CharacterSelect — màn chọn nhân vật 2 bên + chế độ chơi.
// Gọi onStart(p1def, p2def, { cpu }) khi bấm BẮT ĐẦU.
// cpu = null (2 người) | 'easy' | 'normal' | 'hard'
// ============================================================
import { CHARACTERS, getCharacter } from '../config/characters.js';
import { ELEMENTS, counterHint } from '../config/elements.js';

export class CharacterSelect {
  constructor({ onStart }) {
    this.onStart = onStart;
    this.sel = { 1: null, 2: null };
    this.mode = matchMedia('(pointer: coarse)').matches ? 'cpu' : 'pvp';
    this.level = 'normal';
    this.ready = false;
    this.lists = {
      1: document.querySelector('.char-list[data-player="1"]'),
      2: document.querySelector('.char-list[data-player="2"]'),
    };
    this.picked = { 1: document.getElementById('picked-1'), 2: document.getElementById('picked-2') };
    this.p2Title = document.getElementById('p2-title');
    this.p1Hint = document.getElementById('p1-hint');
    this.levelRow = document.getElementById('level-row');
    this.startBtn = document.getElementById('start-btn');

    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.addEventListener('click', () => { this.mode = b.dataset.mode; this._refresh(); });
    });
    document.querySelectorAll('[data-level]').forEach((b) => {
      b.addEventListener('click', () => { this.level = b.dataset.level; this._refresh(); });
    });
    this.startBtn.addEventListener('click', () => this._start());
    this._render();
  }

  setReady(ready, progress = 0) {
    this.ready = ready;
    this.progress = progress;
    this._refresh();
  }

  setError(msg) {
    this.error = msg;
    this._refresh();
  }

  _start() {
    if (!this.ready) return;
    const cpu = this.mode === 'cpu';
    let p2 = this.sel[2];
    if (!this.sel[1] || (!p2 && !cpu)) return;
    if (!p2) {
      const pool = CHARACTERS.filter((c) => c.id !== this.sel[1]);
      p2 = pool[Math.floor(Math.random() * pool.length)].id;
    }
    this.onStart(getCharacter(this.sel[1]), getCharacter(p2), { cpu: cpu ? this.level : null });
  }

  _render() {
    for (const player of [1, 2]) {
      const box = this.lists[player];
      box.innerHTML = '';
      for (const c of CHARACTERS) {
        const el = ELEMENTS[c.element];
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'char-card';
        card.dataset.id = c.id;
        card.style.setProperty('--el', el.css);
        card.innerHTML = `
          <div class="icon">${c.icon}</div>
          <div class="name">${c.name}</div>
          <div class="meta">HP ${c.maxHp}</div>
          <div class="meta">${counterHint(c.element)}</div>
        `;
        card.title = `${c.title}\n${c.desc}\nSkill: ${c.skills.map((s) => s.name).join(' / ')}`;
        card.addEventListener('click', () => this.pick(player, c.id));
        box.appendChild(card);
      }
    }
    this._refresh();
  }

  pick(player, id) {
    // Bấm lại tướng đang chọn của Máy = bỏ chọn (để random)
    this.sel[player] = player === 2 && this.mode === 'cpu' && this.sel[2] === id ? null : id;
    this._refresh();
  }

  _refresh() {
    const cpu = this.mode === 'cpu';
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === this.mode));
    document.querySelectorAll('[data-level]').forEach((b) => b.classList.toggle('active', b.dataset.level === this.level));
    this.levelRow.classList.toggle('hidden', !cpu);
    this.p2Title.innerHTML = cpu
      ? 'Máy <span class="hint">(bỏ trống = ngẫu nhiên)</span>'
      : 'Player 2 <span class="hint">(← → di chuyển • U I O P chiêu)</span>';
    this.p1Hint.textContent = cpu
      ? '(A D / ← → di chuyển • Q W E R / U I O P chiêu)'
      : '(A D di chuyển • Q W E R chiêu)';

    for (const player of [1, 2]) {
      this.lists[player].querySelectorAll('.char-card').forEach((el) => {
        el.classList.toggle('selected', el.dataset.id === this.sel[player]);
      });
      const c = this.sel[player] ? getCharacter(this.sel[player]) : null;
      this.picked[player].innerHTML = c
        ? `<b>${c.icon} ${c.name}</b> — ${c.title}<br><small>${c.desc}<br>Chiêu: ${c.skills.map((s) => `${s.icon} ${s.name}`).join(' · ')}</small>`
        : (player === 2 && cpu ? 'Ngẫu nhiên 🎲' : 'Chưa chọn');
    }
    const canStart = !!this.sel[1] && (cpu || !!this.sel[2]);
    this.startBtn.disabled = !this.ready || !canStart || !!this.error;
    this.startBtn.textContent = this.error ? this.error : this.ready
      ? 'BẮT ĐẦU'
      : `ĐANG TẢI... ${Math.round((this.progress || 0) * 100)}%`;
  }
}
