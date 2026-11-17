// One place for every fact the game balances on: teams, weapon numbers, prices and
// the single mutable game state. Modules read from the state object main.js owns;
// none of them keeps a second copy of a score, a timer or the bomb.
export const TEAMS = { GARUDA: 'garuda', KOMODO: 'komodo' };
export const TEAM_NAME = { garuda: 'Garuda', komodo: 'Komodo' };
export const TEAM_COLOR = { garuda: '#f0a830', komodo: '#35c4b5' };

export const PHASES = {
  MENU: 'menu',
  BUY: 'buy',
  ROUND: 'round',
  INTERMISSION: 'intermission',
  MATCH: 'match',
};

export const ROUND_WINS = 5; // first team to 5 round wins takes the match
export const ROUND_TIME = 100; // seconds per round
export const BUY_TIME = 15; // seconds of buy phase
export const BOMB_TIME = 35; // seconds from plant to detonation
export const PLANT_TIME = 3; // seconds channelling to plant
export const DEFUSE_TIME = 5; // seconds channelling to defuse

// Economy: every number the buy menu shows comes from here.
export const ECONOMY = {
  startMoney: 800,
  killReward: 300,
  roundWin: 1000,
  roundLoss: 500,
  plantReward: 300,
};

// Weapons. damage is per body hit; head hits multiply by headMult. spread is in
// radians of cone half-angle; kick is the camera pitch kick per shot.
export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P-9 Komodo', price: 0,
    damage: 34, headMult: 2, mag: 12, reserve: 48,
    gap: 0.18, reload: 1.4, spreadStill: 0.003, spreadMove: 0.02,
    kick: 0.011, auto: false, range: 60,
  },
  smg: {
    id: 'smg', name: 'Kancil-9', price: 1200,
    damage: 26, headMult: 2, mag: 30, reserve: 120,
    gap: 0.085, reload: 1.7, spreadStill: 0.006, spreadMove: 0.03,
    kick: 0.008, auto: true, range: 55,
  },
  rifle: {
    id: 'rifle', name: 'AR-21 Garuda', price: 2700,
    damage: 38, headMult: 2, mag: 25, reserve: 100,
    gap: 0.11, reload: 2.0, spreadStill: 0.0025, spreadMove: 0.024,
    kick: 0.013, auto: true, range: 80,
  },
  sniper: {
    id: 'sniper', name: 'Elang-50', price: 4000,
    damage: 92, headMult: 2, mag: 5, reserve: 20,
    gap: 1.1, reload: 2.6, spreadStill: 0.0008, spreadMove: 0.05,
    kick: 0.045, auto: false, range: 100,
  },
  grenade: {
    id: 'grenade', name: 'Granat HE', price: 300,
    damage: 100, radius: 5, fuse: 1.6,
  },
};

export const ARMOR_PRICE = 650;
export const ARMOR_ABSORB = 0.35; // share of damage armor takes while it lasts

export function createGameState() {
  return {
    phase: PHASES.MENU,
    round: 1,
    score: { garuda: 0, komodo: 0 },
    timer: 0, // counts down in ROUND; counts down buy time in BUY
    money: ECONOMY.startMoney,
    owned: new Set(['pistol']),
    weapon: 'pistol',
    grenades: 0,
    armor: 0, // armor hit points, 0 = none
    kills: 0,
    deaths: 0,
    bomb: {
      state: 'carried', // carried | planted | detonated | defused
      plantProgress: 0,
      defuseProgress: 0,
      timer: 0, // detonation countdown once planted
      defuser: null,
    },
    feed: [], // { text, kind, at }
    banner: null, // { title, sub, at }
    over: false,
    winner: null,
    winReason: '',
    muted: false,
  };
}
