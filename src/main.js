// ============================================================
// main.js — entry: tải asset -> màn chọn tướng -> Game -> chơi lại.
// ============================================================
import './styles.css';
import { Game } from './Game.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { preloadAssets, renderPortraits } from './utils/AssetLoader.js';
import { CHARACTERS } from './config/characters.js';

const $ = (id) => document.getElementById(id);
const selectScreen = $('select-screen');
const gameScreen = $('game-screen');
const pauseOverlay = $('pause-overlay');
const touchControls = $('touch-controls');
const muteBtn = $('mute-btn');
const isTouch = matchMedia('(pointer: coarse)').matches;

const audio = new AudioSystem();
let game = null;
let lastMatch = null;

const select = new CharacterSelect({
  onStart: (p1def, p2def, opts) => {
    if (!game) return;
    lastMatch = [p1def, p2def, opts];
    audio.unlock();
    selectScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    pauseOverlay.classList.add('hidden');
    const touchMode = isTouch && !!opts.cpu;
    touchControls.classList.toggle('hidden', !touchMode);
    gameScreen.classList.toggle('touch-mode', touchMode);
    game.start(p1def, p2def, opts);
  },
});
select.setReady(false, 0);

function restart() {
  if (!game || !lastMatch) return;
  pauseOverlay.classList.add('hidden');
  game.start(...lastMatch);
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
    if (import.meta.env.DEV) window.__game = game;
    select.setReady(true);
  })
  .catch((err) => {
    console.error(err);
    select.setError('Trình duyệt không hỗ trợ WebGL 😢');
  });
