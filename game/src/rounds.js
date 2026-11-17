// Rounds and the match: buy phase, round, intermission, and the economy that ties
// them together. A round ends by elimination, by the bomb, or by the clock; the
// first team to 5 round wins takes the match.
import { PHASES, ROUND_WINS, ROUND_TIME, BUY_TIME, ECONOMY, WEAPONS, ARMOR_PRICE } from './state.js';

export function createRounds(state, hooks) {
  function startBuyPhase() {
    state.phase = PHASES.BUY;
    state.timer = BUY_TIME;
    hooks.resetPositions();
    hooks.onBuyPhase();
  }

  function startRound() {
    state.phase = PHASES.ROUND;
    state.timer = ROUND_TIME;
    state.bomb.state = 'carried';
    state.bomb.plantProgress = 0;
    state.bomb.defuseProgress = 0;
    hooks.onRoundStart();
  }

  function endRound(winner, reason) {
    if (state.phase !== PHASES.ROUND) return;
    state.score[winner] += 1;
    const won = winner === 'garuda';
    state.money += won ? ECONOMY.roundWin : ECONOMY.roundLoss;
    state.banner = {
      title: won ? 'RONDE MENANG' : 'RONDE KALAH',
      sub: reason,
      at: 0,
    };
    state.phase = PHASES.INTERMISSION;
    state.timer = 4;
    hooks.onRoundEnd(winner, reason);
    if (state.score[winner] >= ROUND_WINS) {
      state.over = true;
      state.winner = winner;
      state.winReason = `Skor ${state.score.garuda} - ${state.score.komodo}`;
      state.phase = PHASES.MATCH;
      hooks.onMatchEnd(winner);
    }
  }

  // Called every fixed step; returns nothing, ends the round when a condition hits.
  function step(dt, ctx) {
    if (state.phase === PHASES.BUY) {
      state.timer -= dt;
      if (state.timer <= 0) startRound();
      return;
    }
    if (state.phase === PHASES.INTERMISSION) {
      state.timer -= dt;
      if (state.timer <= 0 && !state.over) startBuyPhase();
      return;
    }
    if (state.phase !== PHASES.ROUND) return;
    state.timer -= dt;
    // Bomb outcomes are decided by the bomb module and reported here.
    if (ctx.bombEvent === 'detonated') {
      endRound('garuda', 'Perangkat meledak di Site A.');
      return;
    }
    if (ctx.bombEvent === 'defused') {
      endRound('komodo', 'Perangkat berhasil dijinakkan.');
      return;
    }
    if (ctx.komodoAlive === 0) {
      endRound('garuda', 'Tim Komodo habis.');
      return;
    }
    if (!ctx.playerAlive && ctx.garudaBotsAlive === 0) {
      endRound('komodo', 'Tim Garuda habis.');
      return;
    }
    if (state.timer <= 0 && state.bomb.state !== 'planted') {
      endRound('komodo', 'Waktu habis, perangkat tidak ditanam.');
    }
  }

  function buy(id) {
    if (state.phase !== PHASES.BUY) return false;
    if (id === 'grenade') {
      if (state.grenades >= 1 || state.money < WEAPONS.grenade.price) return false;
      state.money -= WEAPONS.grenade.price;
      state.grenades = 1;
      return true;
    }
    if (id === 'armor') {
      if (state.armor >= 100 || state.money < ARMOR_PRICE) return false;
      state.money -= ARMOR_PRICE;
      state.armor = 100;
      return true;
    }
    const weapon = WEAPONS[id];
    if (!weapon || weapon.price === 0) return false;
    if (state.owned.has(id) || state.money < weapon.price) return false;
    state.money -= weapon.price;
    state.owned.add(id);
    hooks.onBought(id);
    return true;
  }

  function nextMatch() {
    state.round = 1;
    state.score = { garuda: 0, komodo: 0 };
    state.money = ECONOMY.startMoney;
    state.owned = new Set(['pistol']);
    state.weapon = 'pistol';
    state.grenades = 0;
    state.armor = 0;
    state.kills = 0;
    state.deaths = 0;
    state.over = false;
    state.winner = null;
    state.winReason = '';
    state.banner = null;
    state.bomb.state = 'carried';
    startBuyPhase();
  }

  return {
    startBuyPhase,
    startRound,
    endRound,
    step,
    buy,
    nextMatch,
  };
}
