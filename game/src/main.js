// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the display's
// rate. ?shot=start|play|end with &seed=N sets up a deterministic frame for a
// capture, renders it twice, then freezes it and sets window.__shotReady.
// Senja Strike: Tim Garuda (the player plus two allies) attacks Site A against
// four Komodo defenders, in rounds, with money, a buy menu and a bomb to plant.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createArsenal, createGrenadeSystem, createTracers } from './weapons.js';
import { createBots } from './bots.js';
import { createBomb } from './bomb.js';
import { createRounds } from './rounds.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createGameState, PHASES, ECONOMY, WEAPONS, TEAMS } from './state.js';
import { mulberry32, clamp, _v1, _v2, _dir, _ray } from './util.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 26, 60);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const state = createGameState();
const world = createWorld(scene);
const audio = createAudio();
const hud = createHud(state);
const player = createPlayer(world.colliders);
const arsenal = createArsenal(camera);
const grenades = createGrenadeSystem(scene);
const tracers = createTracers(scene);
const bots = createBots(scene, world, random);
const bomb = createBomb(world, state);
const input = createInput(renderer.domElement, onLockChange);
bots.spawnAll();

const body = player.state;
const ammoMemory = new Map(); // weapon id -> { mag, reserve } kept across switches
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let prevFiring = false;
const noises = []; // { pos: Vector3, at: seconds } — what bots heard

function pushNoise(pos, at) {
  noises.push({ pos: pos.clone(), at });
  if (noises.length > 12) noises.shift();
}

function resetPositions() {
  player.reset(world.spawns.garuda[0], 0);
  bots.reset(world.spawns);
  arsenal.refill();
  bomb.reset();
  noises.length = 0;
}

const rounds = createRounds(state, {
  resetPositions,
  onBuyPhase() {
    hud.renderBuy();
    hud.showOverlay('buy');
    input.releaseLock();
  },
  onRoundStart() {
    hud.hideOverlays();
    hud.banner('RONDE ' + state.round, 'Tanam perangkat di Site A — atau habisi Tim Komodo.');
    if (!shot) input.requestLock();
  },
  onRoundEnd(winner) {
    audio[winner === 'garuda' ? 'roundWin' : 'roundLose']();
    hud.showRoundEnd(
      winner === 'garuda' ? 'RONDE MENANG' : 'RONDE KALAH',
      state.banner ? state.banner.sub : '',
    );
    input.releaseLock();
  },
  onMatchEnd(winner) {
    hud.showMatch(winner, state.winReason);
    input.releaseLock();
  },
  onBought() {
    audio.buy();
    hud.renderBuy();
  },
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    if (state.phase === PHASES.ROUND) hud.hideOverlays();
  } else if (state.phase === PHASES.ROUND && player.state.alive && !state.over) {
    hud.showOverlay('pause');
  }
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  hud.hideOverlays();
  rounds.startBuyPhase();
});
hud.onBuy((id) => {
  if (rounds.buy(id)) {
    if (WEAPONS[id] && id !== 'grenade') selectWeapon(id);
  }
});
hud.onStartRound(() => {
  if (state.phase === PHASES.BUY) rounds.startRound();
});
hud.onRestart(() => {
  audio.unlock();
  rounds.nextMatch();
});
hud.onResume(() => {
  hud.hideOverlays();
  input.requestLock();
});

function selectWeapon(id) {
  if (!state.owned.has(id)) return;
  const stash = arsenal.stash();
  ammoMemory.set(stash.id, { mag: stash.mag, reserve: stash.reserve });
  const saved = ammoMemory.get(id);
  arsenal.select(id);
  if (saved) {
    arsenal.state.mag = saved.mag;
    arsenal.state.reserve = saved.reserve;
  }
  state.weapon = id;
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(clamp(dy / length, -1, 1));
  syncCamera();
}

function shoot() {
  const def = arsenal.def();
  if (!arsenal.takeRound()) {
    audio.dryFire();
    return false;
  }
  camera.getWorldDirection(_dir);
  const spread = shot ? 0 : arsenal.spread(player.groundSpeed(), body.crouching);
  _dir.x += (random() * 2 - 1) * spread;
  _dir.y += (random() * 2 - 1) * spread;
  _dir.z += (random() * 2 - 1) * spread;
  _dir.normalize();
  scene.updateMatrixWorld(true);
  _ray.set(camera.position, _dir);
  _ray.far = def.range;
  const shootables = world.shootables.concat(bots.hitMeshes());
  const hit = _ray.intersectObjects(shootables, false)[0];
  if (hit) {
    tracers.fire(camera.position, hit.point, '#ffd27a');
    if (hit.object.userData.bot) {
      const target = hit.object.userData.bot;
      const part = hit.object.userData.part;
      const damage = def.damage * (part === 'head' ? def.headMult : 1);
      const killed = bots.damage(target, damage);
      hud.hitMarker(killed);
      if (killed) {
        state.kills += 1;
        state.money += ECONOMY.killReward;
        hud.feed(`Kamu menggugurkan ${target.name} (+${ECONOMY.killReward})`, 'kill');
        audio.kill();
      } else {
        audio.hit();
      }
    }
  } else {
    tracers.fire(camera.position, _v1.copy(camera.position).addScaledVector(_dir, def.range), '#ffd27a');
  }
  arsenal.pullTrigger();
  player.recoil(def.kick, (random() * 2 - 1) * def.kick * 0.4);
  audio.shot(0, true);
  pushNoise(body.position, elapsed);
  return true;
}

function explodeGrenade(center) {
  audio.explosion();
  pushNoise(center, elapsed);
  const radius = WEAPONS.grenade.radius;
  for (const bot of bots.list) {
    if (!bot.alive) continue;
    const distance = bot.position.distanceTo(center);
    if (distance > radius) continue;
    const damage = Math.round(WEAPONS.grenade.damage * (1 - (distance / radius) * 0.8));
    const killed = bots.damage(bot, damage);
    if (killed && bot.team === TEAMS.KOMODO) {
      state.kills += 1;
      state.money += ECONOMY.killReward;
      hud.feed(`Granatmu menggugurkan ${bot.name} (+${ECONOMY.killReward})`, 'kill');
      audio.kill();
    }
  }
  const playerDistance = body.position.distanceTo(center);
  if (playerDistance < radius && body.alive) {
    const damage = Math.round(WEAPONS.grenade.damage * (1 - (playerDistance / radius) * 0.8) * 0.5);
    damagePlayer(damage, null);
  }
}

function damagePlayer(amount, bot) {
  if (!body.alive) return;
  const died = player.damage(amount);
  hud.damageFlash();
  audio.hurt();
  if (died) {
    state.deaths += 1;
    hud.feed(bot ? `${bot.name} menggugurkanmu` : 'Kamu gugur', 'death');
    hud.banner('KAMU GUGUR', 'Tunggu ronde berikutnya.');
    input.releaseLock();
  }
}

function damageBot(target, amount, part, attacker) {
  const killed = bots.damage(target, amount);
  if (!killed) return;
  const attackerName = attacker ? attacker.name : 'Granat';
  hud.feed(`${attackerName} menggugurkan ${target.name}`, attacker && attacker.team === TEAMS.GARUDA ? 'kill' : 'death');
  if (target.team === TEAMS.KOMODO && state.bomb.state === 'planted') {
    // A defuser going down wipes the defuse channel.
    state.bomb.defuseProgress = 0;
  }
}

function step(dt) {
  elapsed += dt;
  const keys = input.state.keys;

  if (state.phase === PHASES.MENU) return;

  // Look is applied in frame(); here the simulation runs.
  const firing = input.state.firing;
  const wantFire = state.phase === PHASES.ROUND && body.alive && (arsenal.def().auto ? firing : firing && !prevFiring);
  if (wantFire && arsenal.ready()) shoot();
  prevFiring = firing;

  if (input.pressed('KeyR')) arsenal.reload();
  if (state.phase === PHASES.BUY) {
    if (input.pressed('Digit1')) selectWeapon('pistol');
    if (input.pressed('Digit2')) { if (!state.owned.has('smg')) rounds.buy('smg'); selectWeapon('smg'); }
    if (input.pressed('Digit3')) { if (!state.owned.has('rifle')) rounds.buy('rifle'); selectWeapon('rifle'); }
    if (input.pressed('Digit4')) { if (!state.owned.has('sniper')) rounds.buy('sniper'); selectWeapon('sniper'); }
    if (input.pressed('Digit5')) rounds.buy('grenade');
    if (input.pressed('Digit6')) rounds.buy('armor');
    if (input.pressed('Enter')) rounds.startRound();
  } else {
    if (input.pressed('Digit1')) selectWeapon('pistol');
    if (input.pressed('Digit2')) selectWeapon('smg');
    if (input.pressed('Digit3')) selectWeapon('rifle');
    if (input.pressed('Digit4')) selectWeapon('sniper');
  }
  if (input.pressed('KeyG') && state.phase === PHASES.ROUND && state.grenades > 0 && body.alive) {
    camera.getWorldDirection(_dir);
    _v1.copy(camera.position);
    if (grenades.throwFrom(_v1, _dir)) {
      state.grenades -= 1;
      audio.throwWhoosh();
    }
  }

  if (state.phase === PHASES.BUY || state.phase === PHASES.ROUND) {
    player.step(dt, keys);
  }
  arsenal.step(dt, player.groundSpeed(), body.crouching);
  const blast = grenades.step(dt);
  if (blast) explodeGrenade(blast);
  tracers.step(dt);

  let bombEvent = null;
  if (state.phase === PHASES.ROUND) {
    const env = {
      playerPos: body.position,
      playerAlive: body.alive,
      playerSpeed: player.groundSpeed(),
      tracers,
      audio,
      time: elapsed,
      noises,
      bomb: state.bomb,
      damagePlayer,
      damageBot,
    };
    bots.step(dt, env);
    bombEvent = bomb.step(dt, body, keys, audio);
  }
  rounds.step(dt, {
    bombEvent,
    komodoAlive: bots.aliveCount(TEAMS.KOMODO),
    garudaBotsAlive: bots.aliveCount(TEAMS.GARUDA),
    playerAlive: body.alive,
  });

  // Old noises stop mattering after a few seconds.
  while (noises.length > 0 && elapsed - noises[0].at > 3) noises.shift();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    hud.update(dt, body, arsenal, bomb.inZone(body.position));
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlays();
  if (name === 'start') {
    body.position.set(0.6, 0, 12);
    body.yaw = 0;
    body.pitch = 0;
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, -10));
    hud.showOverlay('menu');
  } else if (name === 'play') {
    state.phase = PHASES.ROUND;
    state.timer = 88;
    state.money = 2700;
    body.position.set(-3, 0, 6);
    settle(20);
    const enemy = bots.list.find((bot) => bot.team === TEAMS.KOMODO && bot.alive);
    if (enemy) {
      enemy.position.set(-3, 0, -1);
      enemy.group.position.copy(enemy.position);
      _v1.set(enemy.position.x, 1.4, enemy.position.z);
      aimAt(_v1);
      shoot();
      settle(10);
      aimAt(_v1);
      shoot();
      settle(12);
    }
  } else {
    // end: Garuda just took the round at the site.
    state.phase = PHASES.INTERMISSION;
    state.score.garuda = 1;
    state.bomb.state = 'planted';
    state.bomb.timer = 12;
    body.position.set(-2, 0, -4);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.2, -10));
    hud.showRoundEnd('RONDE MENANG', 'Perangkat meledak di Site A.');
    settle(10);
  }
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    hud.update(0.016, body, arsenal, bomb.inZone(body.position));
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
