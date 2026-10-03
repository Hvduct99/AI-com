// ============================================================
// Game — điều phối toàn bộ trận đấu.
// input/AI -> di chuyển -> biên -> skill -> đạn -> combat -> fx -> HUD
// Trạng thái: countdown -> fight -> over. Có pause (Esc).
// ============================================================
import * as THREE from 'three';
import { Character } from './entities/Character.js';
import { castSkill } from './entities/Skill.js';
import { Arena, HALF_BOUND } from './entities/Arena.js';
import { InputSystem, BLOCK_INDEX, JUMP_INDEX } from './systems/InputSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { EffectSystem } from './systems/EffectSystem.js';
import { AIController } from './systems/AIController.js';
import { HUD } from './ui/HUD.js';
import { AssetBuilders, makeSkyTexture } from './utils/AssetLoader.js';
import { ELEMENTS } from './config/elements.js';
import { CHARACTERS, ENERGY } from './config/characters.js';

const ROUND_TIME = 99;
const MIN_SEPARATION = 1.3;
const PROJECTILE_LIGHTS = 3;

export class Game {
  constructor(canvas, { audio } = {}) {
    this.canvas = canvas;
    this.audio = audio;
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(0x2a1838, 30, 80);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.camPos = new THREE.Vector3(0, 3.6, 10);
    this.camLook = new THREE.Vector3(0, 1.7, 0);
    this._camTarget = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x40283a, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 2.4);
    dir.position.set(4, 10, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -14; dir.shadow.camera.right = 14;
    dir.shadow.camera.top = 12; dir.shadow.camera.bottom = -4;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xfff2d9, 0.9);
    fill.position.set(0, 4, 10);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x9b7bff, 0.8);
    rim.position.set(0, 6, -8);
    this.scene.add(rim);

    // Pool đèn cố định cho đạn: số đèn không đổi => không biên dịch lại shader
    this.projLights = [];
    for (let i = 0; i < PROJECTILE_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 2);
      l.position.set(0, -50, 0);
      this.scene.add(l);
      this.projLights.push(l);
    }

    this.arena = new Arena(this.scene);
    this.fx = new EffectSystem(this.scene);
    this.input = new InputSystem();
    this.input.onPause = () => this.togglePause();
    this.hud = new HUD();
    this.combat = new CombatSystem({ onHit: (info) => this._onHit(info) });

    this.fighters = [];
    this.projectiles = [];
    this.state = 'idle';
    this.paused = false;
    this.running = false;
    this.ai = null;
    this.shake = 0;
    this.hitStop = 0;
    this.slowMo = 0;
    this.stateT = 0;
    this.timeLeft = ROUND_TIME;
    this.denyCd = [0, 0];
    this.onPauseChange = null;
    this.onEnd = null;      // (result) => gọi khi bảng kết quả hiện ra
    this._raf = 0;
    this._prewarmed = false;
    this.clock = new THREE.Clock(false);

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
    this._loop = this._loop.bind(this);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused && ['fight', 'countdown', 'intro'].includes(this.state)) {
        this.togglePause();
      }
    });
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Biên dịch trước shader của đạn/chữ để lần bắn đầu tiên không bị khựng */
  _prewarm() {
    if (this._prewarmed) return;
    this._prewarmed = true;
    const tmp = new THREE.Group();
    for (const c of CHARACTERS) {
      for (const sk of c.skills) tmp.add(AssetBuilders.ProjectileBuilder(sk, sk.element));
    }
    const shield = AssetBuilders.ShieldBuilder('kim');
    shield.visible = true;
    tmp.add(shield);
    tmp.position.set(0, 1.5, 0);
    this.scene.add(tmp);
    this.fx.hitText(new THREE.Vector3(0, -20, 0), ' ');
    for (const r of [...this.fx.rings, ...this.fx.flashes, this.fx.pillar]) r.visible = true;
    try { this.renderer.compile(this.scene, this.camera); } catch { /* không quan trọng */ }
    this.scene.remove(tmp);
    this.fx.clear();
  }

  /**
   * @param {object} opts
   *   cpu      : null (2 người) | 'easy'|'normal'|'hard' | số 0..1 (độ khó AI)
   *   foeHpMul / foeDmgMul : nhân máu / sát thương tướng địch (Chinh Phạt)
   *   intro    : chữ giới thiệu ải trước khi đếm ngược
   *   badge    : nhãn nhỏ dưới đồng hồ (vd "ẢI 3/10")
   */
  start(p1def, p2def, { cpu = null, foeHpMul = 1, foeDmgMul = 1, intro = null, badge = null } = {}) {
    for (const f of this.fighters) f.dispose(this.scene);
    for (const p of this.projectiles) p.kill();
    this.fx.clear();
    this.projectiles = [];
    this.shake = 0;
    this.hitStop = 0;
    this.slowMo = 0;
    this.paused = false;
    this.timeLeft = ROUND_TIME;
    this.denyCd = [0, 0];

    const f1 = new Character(this.scene, p1def, 1);
    const f2 = new Character(this.scene, p2def, -1);
    f1.setMesh(AssetBuilders.CharacterBuilder(p1def));
    f2.setMesh(AssetBuilders.CharacterBuilder(p2def));
    if (foeHpMul !== 1) {
      f2.maxHp = Math.round(p2def.maxHp * foeHpMul);
      f2.hp = f2.maxHp;
    }
    f2.dmgMul = foeDmgMul;
    f1.update(0); f2.update(0);
    this.fighters = [f1, f2];
    this.ai = cpu !== null && cpu !== undefined ? new AIController(cpu) : null;
    this.input.singlePlayer = !!this.ai;
    this.hud.setup(p1def, p2def, !!this.ai);
    this.hud.setBadge(badge);
    this.input.reset();
    this.input.enabled = false;
    this.intro = intro;
    this.result = null;
    this._setState(intro ? 'intro' : 'countdown');
    this._prewarm();

    cancelAnimationFrame(this._raf);
    this.running = true;
    this.clock.start();
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.state = 'idle';
    this.input.enabled = false;
    this.input.reset();
    cancelAnimationFrame(this._raf);
    this.clock.stop();
  }

  togglePause() {
    if (!this.running || this.state === 'over' || this.state === 'idle') return;
    this.paused = !this.paused;
    this.input.reset();
    this.input.enabled = !this.paused && this.state === 'fight';
    this.onPauseChange?.(this.paused);
  }

  _setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._loop);
    const realDt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.paused) {
      let dt = realDt;
      if (this.hitStop > 0) { this.hitStop -= realDt; dt *= 0.12; }
      else if (this.slowMo > 0) { this.slowMo -= realDt; dt *= 0.3; }
      this._update(dt, realDt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  _onHit(info) {
    if (info.type === 'hit') {
      const big = info.ultimate || info.counter;
      this.audio?.hit(big);
      this.shake = Math.min(0.6, this.shake + (info.ultimate ? 0.45 : info.counter ? 0.25 : 0.1));
      if (big) this.hitStop = 0.07;
    } else if (info.type === 'block') {
      this.audio?.block(info.perfect);
      this.shake = Math.min(0.6, this.shake + (info.perfect ? 0.2 : 0.08));
      if (info.perfect) this.hitStop = 0.09;
    } else {
      this.audio?.clash();
      this.shake = Math.min(0.6, this.shake + 0.12);
    }
  }

  _separate(f1, f2) {
    // Đang nhảy cao hơn hẳn đối thủ thì được bay qua đầu
    if (Math.abs(f1.pos.y - f2.pos.y) > 2.0) return;
    let d = f2.pos.x - f1.pos.x;
    if (Math.abs(d) >= MIN_SEPARATION) return;
    const s = d === 0 ? 1 : Math.sign(d);
    const push = (MIN_SEPARATION - Math.abs(d)) / 2;
    f1.pos.x = THREE.MathUtils.clamp(f1.pos.x - s * push, -HALF_BOUND, HALF_BOUND);
    f2.pos.x = THREE.MathUtils.clamp(f2.pos.x + s * push, -HALF_BOUND, HALF_BOUND);
    d = f2.pos.x - f1.pos.x;
    if (Math.abs(d) < MIN_SEPARATION - 1e-4) {
      // 1 người bị kẹp sát tường -> đẩy người còn lại
      if (Math.abs(f1.pos.x) >= HALF_BOUND - 1e-4) f2.pos.x = f1.pos.x + s * MIN_SEPARATION;
      else f1.pos.x = f2.pos.x - s * MIN_SEPARATION;
    }
  }

  _castQueued(f1, f2) {
    for (const q of this.input.drainSkillQueue()) {
      const caster = q.player === 1 ? f1 : f2;
      if (q.index === JUMP_INDEX) {
        if (caster.jump()) {
          this.audio?.jump();
          this.fx.burst(caster.pos.clone().setY(0.15), 0xd8c8b0, 8, 2.5, 0.5);
        }
        continue;
      }
      if (q.index === BLOCK_INDEX) {
        if (caster.block()) {
          this.audio?.shieldUp();
        } else if (caster.alive && caster.blockCd <= 0 && this.denyCd[q.player - 1] <= 0) {
          this.denyCd[q.player - 1] = 0.8;
          this.fx.hitText(caster.pos.clone().setY(3.2), 'THIẾU NĂNG LƯỢNG!', '#90caf9', false);
          this.audio?.denied();
        }
        continue;
      }
      const skill = caster.def.skills[q.index];
      if (!skill) continue;
      if (!caster.canCast(q.index)) {
        const k = q.player - 1;
        if (skill.isUltimate && caster.alive && caster.energy < ENERGY.ultCost && this.denyCd[k] <= 0) {
          this.denyCd[k] = 0.8;
          this.fx.hitText(caster.pos.clone().setY(3.2), 'CHƯA ĐỦ NỘ!', '#ffd700', false);
          this.audio?.denied();
        }
        continue;
      }
      const p = castSkill(this.scene, caster, q.index, this.projectiles);
      if (!p) continue;
      this.audio?.cast(caster.element, skill.isUltimate);
      if (skill.isUltimate) {
        this.fx.ultiCast(caster.pos, caster.element);
        this.fx.hitText(caster.pos.clone().setY(3.6), skill.name.toUpperCase() + '!', '#ffd700', true);
        this.hud.flash(ELEMENTS[caster.element].css);
        this.shake = 0.55;
      } else {
        this.fx.muzzle(p.mesh.position, caster.element);
      }
    }
  }

  _updateProjectileLights() {
    let li = 0;
    // Ưu tiên ultimate
    for (const pass of [true, false]) {
      for (const p of this.projectiles) {
        if (li >= this.projLights.length) break;
        if (!p.alive || p.skill.isUltimate !== pass) continue;
        const l = this.projLights[li++];
        l.position.copy(p.mesh.position);
        l.color.setHex(ELEMENTS[p.skill.element].color);
        l.intensity = pass ? 40 : 12;
      }
    }
    for (; li < this.projLights.length; li++) this.projLights[li].intensity = 0;
  }

  _updateCamera(dt, f1, f2) {
    const mid = (f1.pos.x + f2.pos.x) / 2;
    const span = Math.abs(f1.pos.x - f2.pos.x);
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfW = span / 2 + (this.camera.aspect < 1 ? 2.3 : 3.4); // màn dọc: sát hơn
    const z = THREE.MathUtils.clamp(Math.max(halfW / (tanH * this.camera.aspect), 12.5), 12.5, 34);
    this._camTarget.set(mid * 0.7, 2.4 + z * 0.13, z);
    this._lookTarget.set(mid * 0.7, 1.8, 0);
    const k = 1 - Math.exp(-dt * 4);
    this.camPos.lerp(this._camTarget, k);
    this.camLook.lerp(this._lookTarget, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
    }
    this.camera.lookAt(this.camLook);
  }

  _update(dt, realDt) {
    const [f1, f2] = this.fighters;
    if (!f1 || !f2) return;
    this.stateT += realDt;
    for (let i = 0; i < 2; i++) if (this.denyCd[i] > 0) this.denyCd[i] -= realDt;

    // --- Giới thiệu ải (Chinh Phạt) -> Đếm ngược ---
    if (this.state === 'intro') {
      this.hud.center(this.intro, 'title');
      if (this.stateT > 1.8) { this.hud.center(''); this._setState('countdown'); }
    } else if (this.state === 'countdown') {
      const n = 3 - Math.floor(this.stateT / 0.8);
      if (n >= 1) {
        if (this.hud.cache.center !== String(n)) this.audio?.beep(false);
        this.hud.center(String(n), 'count');
      } else {
        this.audio?.beep(true);
        this.hud.center('CHIẾN!', 'fight');
        this._setState('fight');
        this.input.reset();
        this.input.enabled = true;
      }
    } else if (this.state === 'fight' && this.stateT > 0.8) {
      this.hud.center('');
    }

    f1.facing = f1.pos.x <= f2.pos.x ? 1 : -1;
    f2.facing = -f1.facing;

    const fighting = this.state === 'fight';
    if (fighting) {
      let ax2 = this.input.moveAxis(2);
      if (this.ai) {
        for (const idx of this.ai.update(dt, f2, f1, this.projectiles)) this.input.queueSkill(2, idx);
        ax2 = this.ai.axis;
      }
      f1.integrate(dt, this.input.moveAxis(1), HALF_BOUND);
      f2.integrate(dt, ax2, HALF_BOUND);
      f1.healEnergy(ENERGY.regen * dt);
      f2.healEnergy(ENERGY.regen * dt);
      this._separate(f1, f2);

      for (const f of this.fighters) {
        if (this.arena.applyEdgeRule(f, dt) && f.edgeTick > 0.4 && f.edgeWarnCd <= 0) {
          f.edgeWarnCd = 1.2;
          this.fx.hitText(f.pos.clone().setY(3.4), 'BIÊN NGUY HIỂM!', '#ff5252', false);
          this.audio?.edge();
        }
      }
      this._castQueued(f1, f2);
    } else {
      // Sau KO vẫn cho văng nốt theo quán tính
      f1.integrate(dt, 0, HALF_BOUND);
      f2.integrate(dt, 0, HALF_BOUND);
      this._separate(f1, f2);
      this.input.drainSkillQueue();
    }
    for (const f of this.fighters) {
      if (f.landed) this.fx.burst(f.pos.clone().setY(0.1), 0xd8c8b0, 10, 3, 0.4);
    }
    this.arena.update(dt);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      if (p.alive && Math.abs(p.mesh.position.x) > HALF_BOUND + 1.5) {
        this.fx.burst(p.mesh.position, 0xffffff, 8, 3, 2);
        p.kill();
      }
      if (p.alive) this.fx.trail(p.mesh.position, p.skill.element, p.skill.isUltimate);
      else this.projectiles.splice(i, 1);
    }
    if (fighting) this.combat.update(this.projectiles, this.fighters, this.fx);
    this._updateProjectileLights();

    f1.update(dt);
    f2.update(dt);
    this.fx.update(dt);
    this.hud.update(f1, f2);
    this._updateCamera(realDt, f1, f2);

    // --- Đồng hồ + kết thúc ---
    if (fighting) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      this.hud.setTimer(Math.ceil(this.timeLeft));
      if (!f1.alive || !f2.alive) this._finish('ko');
      else if (this.timeLeft <= 0) this._finish('time');
    } else if (this.state === 'over') {
      if (!this._celebrated && this.stateT > 1.2) {
        this._celebrated = true;
        this.winner?.celebrate();
        if (this.winner) this.audio?.win();
      }
      if (!this._shown && this.stateT > 2.0) {
        this._shown = true;
        this.hud.center('');
        this.hud.showWinner(this.endText, this.endSub);
        this.onEnd?.(this.result);
      }
    }
  }

  _finish(reason) {
    const [f1, f2] = this.fighters;
    this._setState('over');
    this.input.enabled = false;
    this.input.reset();
    this._celebrated = false;
    this._shown = false;
    let winner = null;
    if (reason === 'time') {
      const r1 = f1.hp / f1.maxHp, r2 = f2.hp / f2.maxHp;
      if (Math.abs(r1 - r2) > 1e-3) winner = r1 > r2 ? f1 : f2;
      this.hud.center('HẾT GIỜ!', 'fight');
      this.endSub = 'Hết giờ — bên còn nhiều máu hơn thắng';
    } else {
      if (f1.alive) winner = f1; else if (f2.alive) winner = f2;
      const loser = winner === f1 ? f2 : f1;
      this.fx.burst(loser.pos.clone().setY(1.6), 0xffffff, 50, 8, 5);
      this.fx.burst(loser.pos.clone().setY(1.6), ELEMENTS[loser.element].color, 40, 6, 6);
      if (winner) this.fx.impact(loser.pos.clone().setY(1.6), winner.element, true);
      this.hud.center('K.O.!', 'ko');
      this.slowMo = 1.2;
      this.shake = 0.6;
      this.audio?.ko();
      this.endSub = winner ? `Còn ${Math.ceil(winner.hp)} / ${winner.maxHp} máu` : '';
    }
    this.winner = winner;
    this.endText = winner ? `${winner.def.icon} ${winner.def.name.toUpperCase()} THẮNG!` : 'HÒA!';
    // 1 = người chơi bên trái thắng, 2 = bên phải thắng, 0 = hòa
    this.result = { winner: winner === f1 ? 1 : winner === f2 ? 2 : 0 };
  }
}
