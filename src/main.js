// ============================================================
// main.js — entry: tải asset -> màn chọn tướng -> Game -> chơi lại.
// ============================================================
import './styles.css';
import { Game } from './Game.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { preloadAssets, renderPortraits } from './utils/AssetLoader.js';
import { CHARACTERS, getCharacter } from './config/characters.js';
import { CAMPAIGN, markCleared, foeFor } from './config/campaign.js';

const $ = (id) => document.getElementById(id);
const selectScreen = $('select-screen');
const gameScreen = $('game-screen');
const pauseOverlay = $('pause-overlay');
const touchControls = $('touch-controls');
const muteBtn = $('mute-btn');
const isTouch = matchMedia('(pointer: coarse)').matches;

const audio = new AudioSystem();
let game = null;
let lastMatch = null; // { p1def, p2def, opts } — opts gốc từ màn chọn (có thể là { campaign })

const isCampaign = (opts) => Number.isInteger(opts?.campaign);

/** Đổi opts Chinh Phạt -> thông số trận cho Game */
function gameOptsFor(opts) {
  if (!isCampaign(opts)) return opts;
  const i = opts.campaign;
  const lv = CAMPAIGN[i];
  return {
    cpu: lv.ai,
    foeHpMul: lv.hpMul,
    foeDmgMul: lv.dmgMul,
    intro: `ẢI ${i + 1}: ${lv.name.toUpperCase()}`,
    badge: `ẢI ${i + 1}/${CAMPAIGN.length}${lv.boss ? ' 👑' : ''}`,
  };
}

function startMatch(p1def, p2def, opts) {
  if (!game) return;
  lastMatch = { p1def, p2def, opts };
  const gopts = gameOptsFor(opts);
  audio.unlock();
  selectScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  $('end-overlay').classList.add('hidden');
  $('next-btn').classList.add('hidden');
  $('restart-btn').textContent = isCampaign(opts) ? 'ĐÁNH LẠI ẢI' : 'CHƠI LẠI';
  const vsCpu = gopts.cpu !== null && gopts.cpu !== undefined;
  const touchMode = isTouch && vsCpu;
  touchControls.classList.toggle('hidden', !touchMode);
  gameScreen.classList.toggle('touch-mode', touchMode);
  game.start(p1def, p2def, gopts);
}

/** Bảng kết quả hiện ra: xử lý tiến độ Chinh Phạt */
function onMatchEnd(result) {
  if (!lastMatch || !isCampaign(lastMatch.opts)) return;
  const i = lastMatch.opts.campaign;
  const title = $('winner-text');
  const sub = $('winner-sub');
  if (result?.winner === 1) {
    const progress = markCleared(select.campaign, i);
    const hasNext = i + 1 < CAMPAIGN.length;
    select.setCampaign(progress, hasNext ? i + 1 : i);
    if (hasNext) {
      title.textContent = `🏆 ĐẠI THẮNG ẢI ${i + 1}!`;
      sub.textContent = `Đã mở khóa ải ${i + 2}: ${CAMPAIGN[i + 1].name}`;
      $('next-btn').classList.remove('hidden');
    } else {
      title.textContent = '👑 THỐNG NHẤT THIÊN HẠ!';
      sub.textContent = `Đã chinh phạt toàn bộ ${CAMPAIGN.length} ải. Chọn tướng khác để chơi lại!`;
    }
  } else {
    sub.textContent = `Thất bại ở ải ${i + 1}: ${CAMPAIGN[i].name} — đánh lại nào!`;
  }
}

function nextStage() {
  if (!lastMatch || !isCampaign(lastMatch.opts)) return;
  const next = lastMatch.opts.campaign + 1;
  if (next >= CAMPAIGN.length || next >= select.campaign.unlocked) return;
  const p1 = lastMatch.p1def;
  startMatch(p1, getCharacter(foeFor(CAMPAIGN[next], p1.id)), { campaign: next });
}

const select = new CharacterSelect({ onStart: startMatch });
select.setReady(false, 0);

function restart() {
  if (!game || !lastMatch) return;
  startMatch(lastMatch.p1def, lastMatch.p2def, lastMatch.opts);
}

function toMenu() {
  game?.stop();
  pauseOverlay.classList.add('hidden');
  $('end-overlay').classList.add('hidden');
  gameScreen.classList.add('hidden');
  selectScreen.classList.remove('hidden');
}

function bindClick(id, fn) {
  $(id).addEventListener('click', (e) => {
    e.currentTarget.blur(); // tránh Space/Enter bấm lại nút đang focus
    fn();
  });
}

bindClick('restart-btn', restart);
bindClick('next-btn', nextStage);
bindClick('menu-btn', toMenu);
bindClick('resume-btn', () => game?.togglePause());
bindClick('pause-restart-btn', restart);
bindClick('pause-menu-btn', toMenu);
bindClick('pause-btn', () => game?.togglePause());

const renderMute = () => { muteBtn.textContent = audio.muted ? '🔇' : '🔊'; };
renderMute();
bindClick('mute-btn', () => { audio.unlock(); audio.toggleMute(); renderMute(); });

// Nút cảm ứng -> giả lập phím
touchControls.querySelectorAll('button[data-code]').forEach((btn) => {
  const code = btn.dataset.code;
  const down = (e) => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    btn.classList.add('pressed');
    game?.input.press(code);
  };
  const up = () => {
    btn.classList.remove('pressed');
    game?.input.release(code);
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

// Tải asset (font + model + texture) rồi mới tạo Game
const fontsReady = document.fonts?.ready?.catch(() => {}) ?? Promise.resolve();
Promise.all([preloadAssets((p) => select.setReady(false, p)), fontsReady])
  .then(() => {
    try { select.setPortraits(renderPortraits(CHARACTERS)); } catch (e) { console.warn('[portraits]', e); }
    game = new Game($('game-canvas'), { audio });
    game.onPauseChange = (paused) => pauseOverlay.classList.toggle('hidden', !paused);
    game.onEnd = onMatchEnd;
    if (import.meta.env.DEV) { window.__game = game; window.__select = select; }
    select.setReady(true);
  })
  .catch((err) => {
    console.error(err);
    select.setError('Trình duyệt không hỗ trợ WebGL 😢');
  });
