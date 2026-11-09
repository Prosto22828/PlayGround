import { BLOCKS, SELL_ORDER } from './world.js';

const $ = (id) => document.getElementById(id);
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];

export class UI {
  constructor() {
    this.handlers = {};
    this.toasts = [];
    this.activeTab = 'sell';
    this.last = {};
    this.el = {
      hud: $('hud'),
      depth: $('depth-value'),
      best: $('best-value'),
      money: $('money-value'),
      bankSub: $('bank-sub'),
      weight: $('weight-label'),
      packFill: $('pack-fill'),
      invChips: $('inv-chips'),
      drillName: $('drill-name'),
      drillSpeed: $('drill-speed'),
      drillPower: $('drill-power'),
      objectiveText: $('objective-text'),
      objectiveReward: $('objective-reward'),
      objectiveCard: $('objective-card'),
      prompt: $('interact-prompt'),
      promptText: $('prompt-text'),
      crosshair: $('crosshair'),
      ringFill: $('ring-fill'),
      signal: $('signal'),
      signalDist: $('signal-dist'),
      signalArrow: $('signal-arrow'),
      toasts: $('toasts'),
      tint: $('depth-tint'),
      fade: $('fade'),
      screens: {
        start: $('screen-start'),
        pause: $('screen-pause'),
        shop: $('screen-shop'),
        win: $('screen-win'),
        loading: $('loading'),
      },
      shopMoney: $('shop-money'),
      sellList: $('sell-list'),
      sellTotal: $('sell-total'),
      sellAll: $('sell-all'),
      upgradeGrid: $('upgrade-grid'),
      startBtn: $('btn-start'),
      newBtn: $('btn-new'),
      pauseDepth: $('pause-depth'),
      pauseBest: $('pause-best'),
      pauseMined: $('pause-mined'),
      pauseTime: $('pause-time'),
      muteBtn: $('btn-mute'),
      mobile: $('mobile-ui'),
      joystick: $('joystick'),
      joystickKnob: $('joystick-knob'),
      btnDig: $('btn-dig'),
      btnJump: $('btn-jump'),
      btnRecall: $('btn-recall'),
      btnInteract: $('btn-interact'),
    };
    this._wire();
  }

  bind(handlers) {
    this.handlers = handlers;
  }

  _wire() {
    const h = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    this.el.startBtn.addEventListener('click', h(() => this.handlers.start && this.handlers.start(false)));
    this.el.newBtn.addEventListener('click', h(() => this.handlers.start && this.handlers.start(true)));
    $('btn-resume').addEventListener('click', h(() => this.handlers.resume && this.handlers.resume()));
    $('btn-reset').addEventListener('click', h(() => {
      if (window.confirm('Reset the hole? All progress will be lost.')) this.handlers.reset && this.handlers.reset();
    }));
    this.el.muteBtn.addEventListener('click', h(() => this.handlers.mute && this.handlers.mute()));
    $('shop-close').addEventListener('click', h(() => this.handlers.closeShop && this.handlers.closeShop()));
    this.el.sellAll.addEventListener('click', h(() => this.handlers.sell && this.handlers.sell()));
    $('btn-keep').addEventListener('click', h(() => this.handlers.keep && this.handlers.keep()));
    $('btn-again').addEventListener('click', h(() => this.handlers.again && this.handlers.again()));

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', h(() => {
        this.setTab(tab.dataset.tab);
      }));
    });

    this.el.upgradeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.up-buy');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      this.handlers.buy && this.handlers.buy(btn.dataset.id);
    });
  }

  hideAllScreens() {
    for (const key in this.el.screens) this.el.screens[key].classList.add('hidden');
  }

  showStart(hasSave) {
    this.hideAllScreens();
    this.el.screens.start.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.startBtn.textContent = hasSave ? 'CONTINUE DIGGING' : 'START DIGGING';
    this.el.newBtn.classList.toggle('hidden', !hasSave);
  }

  showGame() {
    this.hideAllScreens();
    this.el.hud.classList.remove('hidden');
  }

  showPause(stats) {
    this.el.screens.pause.classList.remove('hidden');
    this.el.pauseDepth.textContent = stats.depth.toFixed(1) + ' m';
    this.el.pauseBest.textContent = stats.best.toFixed(1) + ' m';
    this.el.pauseMined.textContent = stats.mined;
    this.el.pauseTime.textContent = stats.time;
  }

  hidePause() {
    this.el.screens.pause.classList.add('hidden');
  }

  showShop(tab = 'sell') {
    this.el.screens.shop.classList.remove('hidden');
    this.setTab(tab);
    this.refreshShop();
  }

  hideShop() {
    this.el.screens.shop.classList.add('hidden');
  }

  setTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $('sell-panel').classList.toggle('hidden', tab !== 'sell');
    $('upgrade-panel').classList.toggle('hidden', tab !== 'upgrade');
    this.refreshShop();
  }

  showWin(stats) {
    this.hideAllScreens();
    this.el.screens.win.classList.remove('hidden');
    this.el.hud.classList.remove('hidden');
    $('win-depth').textContent = Math.round(stats.depth) + ' m';
    $('win-blocks').textContent = stats.mined;
    $('win-money').textContent = '$' + stats.earned.toLocaleString('en-US');
    $('win-time').textContent = stats.time;
  }

  hideLoading() {
    this.el.screens.loading.classList.add('hidden');
  }

  setLoading(pct) {
    $('loader-fill').style.width = Math.round(pct * 100) + '%';
  }

  setMuted(muted) {
    this.el.muteBtn.textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON');
  }

  setTouch(show) {
    this.el.mobile.classList.toggle('hidden', !show);
  }

  setPrompt(text) {
    if (!text) {
      this.el.prompt.classList.add('hidden');
      return;
    }
    this.el.prompt.classList.remove('hidden');
    this.el.promptText.textContent = text;
  }

  setCrosshair(mode, progress = 0) {
    this.el.crosshair.classList.toggle('targeting', mode === 'target');
    this.el.crosshair.classList.toggle('mining', mode === 'mining');
    const circ = 2 * Math.PI * 19;
    this.el.ringFill.style.strokeDashoffset = String(circ * (1 - Math.max(0, Math.min(1, progress))));
  }

  setSignal(show, dist, angleDeg) {
    this.el.signal.classList.toggle('hidden', !show);
    if (!show) return;
    this.el.signalDist.textContent = Math.round(dist) + ' m';
    this.el.signalArrow.style.transform = `rotate(${angleDeg}deg)`;
  }

  setDepthTint(depth) {
    const v = Math.max(0, Math.min(0.82, (depth - 2) / 34));
    if (Math.abs(v - (this.last.tint || 0)) > 0.01) {
      this.el.tint.style.opacity = v.toFixed(2);
      this.last.tint = v;
    }
  }

  toast(text, kind = '', big = '') {
    const div = document.createElement('div');
    div.className = 'toast ' + kind;
    if (big) {
      const b = document.createElement('span');
      b.className = 't-big';
      b.textContent = big;
      div.appendChild(b);
    }
    const span = document.createElement('span');
    span.textContent = text;
    div.appendChild(span);
    this.el.toasts.appendChild(div);
    this.toasts.push(div);
    while (this.toasts.length > 4) {
      const old = this.toasts.shift();
      old.remove();
    }
    setTimeout(() => {
      div.classList.add('out');
      setTimeout(() => div.remove(), 320);
    }, 3200);
  }

  fade(on) {
    this.el.fade.classList.toggle('on', on);
  }

  updateHUD(game) {
    const p = game.player;
    const depth = p.getDepth();
    const money = game.state.money;
    const weight = game.getWeight();
    const cap = game.getCapacity();
    const inv = game.state.inventory;

    const depthStr = depth.toFixed(1);
    if (this.last.depth !== depthStr) {
      this.el.depth.textContent = depthStr;
      this.last.depth = depthStr;
    }
    const bestStr = game.state.maxDepth.toFixed(1);
    if (this.last.best !== bestStr) {
      this.el.best.textContent = bestStr;
      this.last.best = bestStr;
    }
    if (this.last.money !== money) {
      this.el.money.textContent = money.toLocaleString('en-US');
      this.last.money = money;
    }
    const wStr = weight.toFixed(1) + ' / ' + cap + ' kg';
    if (this.last.weight !== wStr) {
      this.el.weight.textContent = wStr;
      const pct = Math.min(100, (weight / cap) * 100);
      this.el.packFill.style.width = pct.toFixed(1) + '%';
      this.el.packFill.classList.toggle('warn', pct > 72 && pct < 96);
      this.el.packFill.classList.toggle('full', pct >= 96);
      this.last.weight = wStr;
    }

    const invKey = SELL_ORDER.map((id) => (inv[id] || 0)).join(',');
    if (this.last.inv !== invKey) {
      this.last.inv = invKey;
      let html = '';
      for (const id of SELL_ORDER) {
        const n = inv[id] || 0;
        if (!n) continue;
        const def = BLOCKS[id];
        html += `<span class="inv-chip"><span class="inv-swatch" style="background:${def.color}"></span>${n}</span>`;
      }
      this.el.invChips.innerHTML = html;
    }

    const power = game.power;
    const toolName = ['RUSTY SHOVEL', 'RUSTY SHOVEL', 'STEEL DRILL', 'TITAN DRILL', 'CORE DRILL'][Math.min(4, power)];
    if (this.last.tool !== toolName) {
      this.el.drillName.textContent = toolName;
      this.el.drillPower.textContent = ROMAN[Math.min(5, power)];
      this.last.tool = toolName;
    }
    const speedStr = game.speedMult.toFixed(1) + '×';
    if (this.last.speed !== speedStr) {
      this.el.drillSpeed.textContent = speedStr;
      this.last.speed = speedStr;
    }

    const obj = game.getObjective();
    if (this.last.obj !== obj.text) {
      this.el.objectiveText.textContent = obj.text;
      this.el.objectiveReward.textContent = obj.reward ? 'REWARD $' + obj.reward : 'THE DEEPEST SECRET';
      this.last.obj = obj.text;
    }

    this.setDepthTint(depth);
    if (this.last.mobileDepth === undefined || Math.abs(this.last.mobileDepth - depth) > 0.5) {
      this.last.mobileDepth = depth;
    }
  }

  popObjective() {
    this.el.objectiveCard.classList.remove('pop');
    void this.el.objectiveCard.offsetWidth;
    this.el.objectiveCard.classList.add('pop');
  }

  refreshShop() {
    const game = this.handlers.getGame && this.handlers.getGame();
    if (!game) return;
    this.el.shopMoney.textContent = game.state.money.toLocaleString('en-US');
    this.renderSell(game);
    this.renderUpgrades(game);
  }

  renderSell(game) {
    const inv = game.state.inventory;
    let html = '';
    let total = 0;
    let any = false;
    for (const id of SELL_ORDER) {
      const n = inv[id] || 0;
      if (!n) continue;
      any = true;
      const def = BLOCKS[id];
      const unit = def.value;
      const sub = unit * n;
      total += sub;
      html += `<div class="sell-row">
        <div class="sell-name"><span class="sell-swatch" style="background:${def.color}"></span>${def.name}</div>
        <div class="sell-qty">×${n}</div>
        <div class="sell-unit">$${unit.toFixed(2)}</div>
        <div class="sell-sub">$${sub.toFixed(2)}</div>
      </div>`;
    }
    if (!any) {
      html = '<div class="sell-empty"><b>YOUR POCKETS ARE EMPTY</b>Dig into the dirt and come back with something shiny.<br />Ores are worth far more than dirt.</div>';
    }
    this.el.sellList.innerHTML = html;
    this.el.sellTotal.textContent = '$' + Math.round(total).toLocaleString('en-US');
    this.el.sellAll.disabled = total <= 0;
  }

  renderUpgrades(game) {
    const defs = game.upgradeDefs;
    let html = '';
    for (const def of defs) {
      const level = game.state.upgrades[def.id] || 0;
      const maxed = level >= def.levels.length;
      const cost = maxed ? 0 : def.levels[level].cost;
      const affordable = !maxed && game.state.money >= cost;
      const current = def.format(level);
      const next = maxed ? current : def.format(level + 1);
      let pips = '';
      for (let i = 0; i < def.levels.length; i++) pips += `<span class="pip ${i < level ? 'on' : ''}"></span>`;
      html += `<div class="upgrade-card ${maxed ? 'maxed' : affordable ? 'affordable' : ''}">
        <div class="up-top">
          <div class="up-icon">${def.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="up-title">${def.name}</div>
            <div class="up-desc">${def.desc}</div>
          </div>
        </div>
        <div class="up-pips">${pips}</div>
        <div class="up-foot">
          <div class="up-effect">${maxed ? `<b>${current}</b>` : `<b>${current}</b> → <b>${next}</b>`}</div>
          <button class="up-buy ${maxed ? 'maxed' : ''}" data-id="${def.id}" ${maxed || !affordable ? 'disabled' : ''}>${maxed ? 'MAXED' : '$' + cost}</button>
        </div>
      </div>`;
    }
    this.el.upgradeGrid.innerHTML = html;
  }
}
