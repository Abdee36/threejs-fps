// The HUD: every DOM element the player reads, updated from the single game state.
// Text is only rewritten when it changes, so the per-frame sync costs almost
// nothing. The buy menu is rendered fresh each buy phase from the same weapon
// table the simulation uses, so the prices on screen can never drift from the
// prices in code.
import { WEAPONS, ARMOR_PRICE, TEAM_NAME } from './state.js';
import { formatMoney, formatTime } from './util.js';

export function createHud(state) {
  const el = (id) => document.getElementById(id);
  const nodes = {
    healthFill: el('health-fill'),
    healthNum: el('health-num'),
    armorNum: el('armor-num'),
    ammoMag: el('ammo-mag'),
    ammoReserve: el('ammo-reserve'),
    weaponName: el('weapon-name'),
    money: el('money'),
    timer: el('timer'),
    scoreGaruda: el('score-garuda'),
    scoreKomodo: el('score-komodo'),
    roundLabel: el('round-label'),
    bombChip: el('bomb-chip'),
    killfeed: el('killfeed'),
    banner: el('banner'),
    bannerTitle: el('banner-title'),
    bannerSub: el('banner-sub'),
    vignette: el('vignette'),
    crosshair: el('crosshair'),
    hitmarker: el('hitmarker'),
    plantBar: el('plant-bar'),
    plantFill: el('plant-fill'),
    overlays: {
      menu: el('overlay-menu'),
      buy: el('overlay-buy'),
      pause: el('overlay-pause'),
      match: el('overlay-match'),
      round: el('overlay-round'),
    },
    buyItems: el('buy-items'),
    buyMoney: el('buy-money'),
    matchTitle: el('match-title'),
    matchSub: el('match-sub'),
    roundTitle: el('round-title'),
    roundSub: el('round-sub'),
  };

  const cache = {};
  function setText(node, key, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  }

  let hitTimer = 0;
  let bannerTimer = 0;

  function showOverlay(name) {
    for (const [key, node] of Object.entries(nodes.overlays)) {
      if (node) node.hidden = key !== name;
    }
  }
  function hideOverlays() {
    for (const node of Object.values(nodes.overlays)) if (node) node.hidden = true;
  }

  function feed(text, kind = 'info') {
    const item = document.createElement('div');
    item.className = 'feed-item ' + kind;
    item.textContent = text;
    nodes.killfeed.prepend(item);
    while (nodes.killfeed.children.length > 4) nodes.killfeed.lastChild.remove();
    setTimeout(() => item.remove(), 5000);
  }

  function renderBuy() {
    nodes.buyItems.innerHTML = '';
    const entries = [
      ...Object.values(WEAPONS).filter((w) => w.id !== 'grenade'),
      { id: 'grenade', name: WEAPONS.grenade.name, price: WEAPONS.grenade.price },
      { id: 'armor', name: 'Rompi Anti Peluru', price: ARMOR_PRICE },
    ];
    for (const entry of entries) {
      const owned = state.owned.has(entry.id) || (entry.id === 'grenade' && state.grenades > 0) || (entry.id === 'armor' && state.armor > 0);
      const afford = state.money >= entry.price;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buy-item' + (owned ? ' owned' : '') + (!owned && !afford ? ' poor' : '');
      button.dataset.buy = entry.id;
      button.innerHTML = `<span class="buy-name">${entry.name}</span><span class="buy-price">${owned ? 'DIMILIKI' : formatMoney(entry.price)}</span>`;
      nodes.buyItems.appendChild(button);
    }
    setText(nodes.buyMoney, 'buyMoney', formatMoney(state.money));
  }

  return {
    showOverlay,
    hideOverlays,
    feed,
    renderBuy,
    onPlay(callback) {
      el('play').addEventListener('click', callback);
    },
    onBuy(callback) {
      nodes.buyItems.addEventListener('click', (event) => {
        const button = event.target.closest('[data-buy]');
        if (button) callback(button.dataset.buy);
      });
    },
    onStartRound(callback) {
      el('start-round').addEventListener('click', callback);
    },
    onRestart(callback) {
      el('restart').addEventListener('click', callback);
    },
    onResume(callback) {
      el('resume').addEventListener('click', callback);
    },
    hitMarker(kill) {
      nodes.hitmarker.classList.add('on');
      if (kill) nodes.hitmarker.classList.add('kill');
      hitTimer = kill ? 0.25 : 0.09;
    },
    damageFlash() {
      nodes.vignette.style.opacity = '0.55';
      setTimeout(() => { nodes.vignette.style.opacity = '0'; }, 120);
    },
    banner(title, sub) {
      setText(nodes.bannerTitle, 'bannerTitle', title);
      setText(nodes.bannerSub, 'bannerSub', sub);
      nodes.banner.classList.add('show');
      bannerTimer = 2.4;
    },
    showMatch(winner, reason) {
      setText(nodes.matchTitle, 'matchTitle', winner === 'garuda' ? 'TIM GARUDA MENANG' : 'TIM KOMODO MENANG');
      setText(nodes.matchSub, 'matchSub', `${TEAM_NAME[winner]} juara ${reason}`);
      showOverlay('match');
    },
    showRoundEnd(title, sub) {
      setText(nodes.roundTitle, 'roundTitle', title);
      setText(nodes.roundSub, 'roundSub', sub);
      showOverlay('round');
    },
    // Per-frame sync. Called from the render loop, not the fixed step.
    update(dt, player, arsenal, bombInZone) {
      if (hitTimer > 0) {
        hitTimer -= dt;
        if (hitTimer <= 0) {
          nodes.hitmarker.classList.remove('on');
          nodes.hitmarker.classList.remove('kill');
        }
      }
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) nodes.banner.classList.remove('show');
      }
      const health = Math.max(0, Math.round(player.health));
      nodes.healthFill.style.width = health + '%';
      nodes.healthFill.classList.toggle('low', health <= 30);
      setText(nodes.healthNum, 'health', String(health));
      setText(nodes.armorNum, 'armor', player.armor > 0 ? '🛡 ' + Math.round(player.armor) : '');
      setText(nodes.ammoMag, 'ammoMag', String(arsenal.state.mag));
      setText(nodes.ammoReserve, 'ammoReserve', '/ ' + arsenal.state.reserve);
      setText(nodes.weaponName, 'weapon', arsenal.def().name);
      setText(nodes.money, 'money', formatMoney(state.money));
      setText(nodes.timer, 'timer', state.phase === 'buy' ? 'BELI ' + formatTime(state.timer) : formatTime(state.timer));
      setText(nodes.scoreGaruda, 'scoreG', String(state.score.garuda));
      setText(nodes.scoreKomodo, 'scoreK', String(state.score.komodo));
      setText(nodes.roundLabel, 'round', 'RONDE ' + state.round);
      // Bomb chip.
      const bomb = state.bomb;
      let chip = '';
      if (bomb.state === 'carried') chip = bombInZone ? '📦 TEKAN E — TANAM DI SITE A' : '📦 BAWA PERANGKAT KE SITE A';
      else if (bomb.state === 'planted') chip = '💣 MELEDAK ' + formatTime(bomb.timer);
      else if (bomb.state === 'detonated') chip = '💥 MELEDAK';
      else if (bomb.state === 'defused') chip = '🔧 DIJINAKKAN';
      setText(nodes.bombChip, 'bombChip', chip);
      nodes.bombChip.classList.toggle('danger', bomb.state === 'planted');
      // Plant progress bar.
      if (bomb.state === 'carried' && bomb.plantProgress > 0) {
        nodes.plantBar.hidden = false;
        nodes.plantFill.style.width = Math.round((bomb.plantProgress / 3) * 100) + '%';
      } else {
        nodes.plantBar.hidden = true;
      }
      // Crosshair gap follows the current spread.
      const spread = arsenal.spread(0, false);
      const gap = Math.round(4 + spread * 900);
      nodes.crosshair.style.setProperty('--gap', gap + 'px');
    },
  };
}
