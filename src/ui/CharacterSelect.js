// ============================================================
// CharacterSelect — màn chọn tướng + chế độ chơi.
// Gọi onStart(p1def, p2def, opts) khi bấm BẮT ĐẦU:
//   2 người    : opts = { cpu: null }
//   Đấu máy    : opts = { cpu: 'easy' | 'normal' | 'hard' }
//   Chinh Phạt : opts = { campaign: index ải (0-based) }
// ============================================================
import { CHARACTERS, getCharacter } from '../config/characters.js';
import { ELEMENTS, counterHint } from '../config/elements.js';
import { CAMPAIGN, loadProgress, foeFor } from '../config/campaign.js';

const MODES = ['pvp', 'cpu', 'campaign'];

export class CharacterSelect {
  constructor({ onStart }) {
    this.onStart = onStart;
    this.sel = { 1: null, 2: null };
    this.mode = matchMedia('(pointer: coarse)').matches ? 'campaign' : 'pvp';
    this.level = 'normal';
    this.ready = false;
    this.campaign = loadProgress();
    this.stage = this.campaign.unlocked - 1; // ải đang chọn
    this.portraits = {};
    this.lists = {
      1: document.querySelector('.char-list[data-player="1"]'),
      2: document.querySelector('.char-list[data-player="2"]'),
    };
    this.picked = { 1: document.getElementById('picked-1'), 2: document.getElementById('picked-2') };
    this.p2Title = document.getElementById('p2-title');
    this.p1Hint = document.getElementById('p1-hint');
    this.levelRow = document.getElementById('level-row');
    this.stageList = document.getElementById('campaign-list');
    this.startBtn = document.getElementById('start-btn');

    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.addEventListener('click', () => { this.setMode(b.dataset.mode); });
    });
    document.querySelectorAll('[data-level]').forEach((b) => {
      b.addEventListener('click', () => { this.level = b.dataset.level; this._refresh(); });
    });
    this.startBtn.addEventListener('click', () => this._start());
    this._render();
  }

  setMode(mode) {
    if (!MODES.includes(mode)) return;
    this.mode = mode;
    this._refresh();
  }

  setReady(ready, progress = 0) {
    this.ready = ready;
    this.loadProgress = progress;
    this._refresh();
  }

  /** Cập nhật tiến độ Chinh Phạt (sau khi thắng ải) */
  setCampaign(progress, stage = null) {
    this.campaign = progress;
    if (stage !== null) this.stage = Math.min(stage, progress.unlocked - 1);
    this._renderStages();
    this._refresh();
  }

  /** Thay emoji bằng ảnh chân dung 3D: { [id]: dataURL } */
  setPortraits(map) {
    this.portraits = map || {};
    document.querySelectorAll('.char-card').forEach((card) => {
      const url = this.portraits[card.dataset.id];
      const icon = card.querySelector('.icon');
      if (!url || !icon) return;
      const img = new Image();
      img.src = url;
      img.alt = '';
      img.className = 'portrait';
      icon.replaceWith(img);
    });
    this._renderStages();
  }

  setError(msg) {
    this.error = msg;
    this._refresh();
  }

  _start() {
    if (!this.ready || !this.sel[1]) return;
    const p1 = getCharacter(this.sel[1]);
    if (this.mode === 'campaign') {
      if (this.stage < 0 || this.stage >= this.campaign.unlocked) return;
      const foe = getCharacter(foeFor(CAMPAIGN[this.stage], p1.id));
      this.onStart(p1, foe, { campaign: this.stage });
      return;
    }
    const cpu = this.mode === 'cpu';
    let p2 = this.sel[2];
    if (!p2 && !cpu) return;
    if (!p2) {
      const pool = CHARACTERS.filter((c) => c.id !== this.sel[1]);
      p2 = pool[Math.floor(Math.random() * pool.length)].id;
    }
    this.onStart(p1, getCharacter(p2), { cpu: cpu ? this.level : null });
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
          <div class="meta"><span class="style-tag ${c.style}">${c.style === 'melee' ? 'Cận chiến' : 'Tầm xa'}</span> HP ${c.maxHp}</div>
          <div class="meta">${counterHint(c.element)}</div>
        `;
        card.title = `${c.title}\n${c.desc}\nSkill: ${c.skills.map((s) => s.name).join(' / ')}`;
        card.addEventListener('click', () => this.pick(player, c.id));
        box.appendChild(card);
      }
    }
    this._renderStages();
    this._refresh();
  }

  /** Danh sách 10 ải Chinh Phạt */
  _renderStages() {
    const box = this.stageList;
    box.innerHTML = '';
    CAMPAIGN.forEach((lv, i) => {
      const locked = i >= this.campaign.unlocked;
      const cleared = this.campaign.cleared.includes(i);
      const foe = getCharacter(foeFor(lv, this.sel[1]));
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'stage' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '') + (lv.boss ? ' boss' : '');
      b.dataset.stage = String(i);
      b.disabled = locked;
      b.style.setProperty('--el', ELEMENTS[foe.element].css);
      const img = this.portraits[foe.id]
        ? `<img class="stage-face" src="${this.portraits[foe.id]}" alt="">`
        : `<span class="stage-face">${foe.icon}</span>`;
      const status = locked ? '🔒' : cleared ? '✅' : lv.boss ? '👑' : '⚔️';
      b.innerHTML = `
        <span class="stage-no">Ải ${i + 1}</span>
        ${img}
        <span class="stage-info"><b>${lv.name}</b><small>${foe.name}${lv.boss ? ' — TRÙM' : ''} • ${'★'.repeat(1 + Math.round(lv.ai * 4))}</small></span>
        <span class="stage-status">${status}</span>`;
      b.addEventListener('click', () => { this.stage = i; this._refresh(); });
      box.appendChild(b);
    });
  }

  pick(player, id) {
    if (player === 2 && this.mode === 'campaign') return;
    // Bấm lại tướng đang chọn của Máy = bỏ chọn (để random)
    this.sel[player] = player === 2 && this.mode === 'cpu' && this.sel[2] === id ? null : id;
    if (player === 1) this._renderStages(); // tướng địch có thể đổi nếu trùng
    this._refresh();
  }

  _refresh() {
    const cpu = this.mode === 'cpu';
    const camp = this.mode === 'campaign';
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === this.mode));
    document.querySelectorAll('[data-level]').forEach((b) => b.classList.toggle('active', b.dataset.level === this.level));
    this.levelRow.classList.toggle('hidden', !cpu);
    this.lists[2].classList.toggle('hidden', camp);
    this.picked[2].classList.toggle('hidden', camp);
    this.stageList.classList.toggle('hidden', !camp);
    this.stageList.querySelectorAll('.stage').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.stage) === this.stage);
    });
    const clearedN = this.campaign.cleared.length;
    this.p2Title.innerHTML = camp
      ? `Chinh Phạt <span class="hint">(đã thắng ${clearedN}/${CAMPAIGN.length} ải — thắng ải trước để mở ải sau)</span>`
      : cpu
        ? 'Máy <span class="hint">(bỏ trống = ngẫu nhiên)</span>'
        : 'Player 2 <span class="hint">(← → đi • ↑ nhảy • ↓ đỡ • H J K chiêu • L tuyệt chiêu)</span>';
    this.p1Hint.textContent = cpu || camp
      ? '(A D / ← → đi • X / ↑ nhảy • S / ↓ đỡ • Q W E / H J K chiêu • R / L tuyệt chiêu)'
      : '(A D đi • X nhảy • S đỡ • Q W E chiêu • R tuyệt chiêu)';

    for (const player of [1, 2]) {
      this.lists[player].querySelectorAll('.char-card').forEach((el) => {
        el.classList.toggle('selected', el.dataset.id === this.sel[player]);
      });
      const c = this.sel[player] ? getCharacter(this.sel[player]) : null;
      this.picked[player].innerHTML = c
        ? `<b>${c.icon} ${c.name}</b> — ${c.title}<br><small>${c.desc}<br>Chiêu: ${c.skills.map((s) => `${s.icon} ${s.name}`).join(' · ')}</small>`
        : (player === 2 && cpu ? 'Ngẫu nhiên 🎲' : 'Chưa chọn');
    }
    const stageOk = this.stage >= 0 && this.stage < this.campaign.unlocked;
    const canStart = !!this.sel[1] && (camp ? stageOk : cpu || !!this.sel[2]);
    this.startBtn.disabled = !this.ready || !canStart || !!this.error;
    this.startBtn.textContent = this.error ? this.error : !this.ready
      ? `ĐANG TẢI... ${Math.round((this.loadProgress || 0) * 100)}%`
      : camp ? `XUẤT CHINH — ẢI ${this.stage + 1}` : 'BẮT ĐẦU';
  }
}
