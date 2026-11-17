// Bots: the other nine actors on the map. Two ally bots push with the player,
// four Komodo bots defend Site A. Each bot is a small procedural soldier in its
// team's colour, with a body hitbox and a head hitbox worth double damage.
// AI is deliberately simple and readable: patrol a route, hold a post, engage
// what it can see, investigate a sound it heard, and rush the site to defuse
// once the bomb is down. No bot ever teleports, sees through walls or knows
// where the player is without line of sight or a sound.
import * as THREE from 'three';
import { TEAMS } from './state.js';
import { clamp, _v1, _v2, _v3, _ray } from './util.js';

const RADIUS = 0.34;
const HEIGHT = 1.72;
const EYE = 1.5;
const PATROL_SPEED = 2.6;
const PUSH_SPEED = 3.4;
const STRAFE_SPEED = 2.2;
const BOT_HEALTH = 100;
const SEE_RANGE = 34;
const HEAR_RANGE = 24;

function buildSoldier(teamColor) {
  const group = new THREE.Group();
  const torsoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.7, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#23262c'), roughness: 0.8, metalness: 0.1 });
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a184'), roughness: 0.8, metalness: 0 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), torsoMat);
  torso.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
  head.position.y = 1.62;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.05), darkMat);
  visor.position.set(0, 1.64, -0.17);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.2), darkMat);
  legL.position.set(-0.14, 0.34, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.2), darkMat);
  legR.position.set(0.14, 0.34, 0);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), darkMat);
  gun.position.set(0.2, 1.15, -0.35);
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.32), darkMat);
  shoulder.position.y = 1.42;
  group.add(torso, head, visor, legL, legR, gun, shoulder);
  group.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return { group, torso, head };
}

export function createBots(scene, world, random) {
  const bots = [];

  function overlaps(x, y, z, height, lift) {
    const min = new THREE.Vector3(x - RADIUS, y + lift, z - RADIUS);
    const max = new THREE.Vector3(x + RADIUS, y + height - lift, z + RADIUS);
    for (const collider of world.colliders) {
      if (min.x < collider.max.x && max.x > collider.min.x
        && min.y < collider.max.y && max.y > collider.min.y
        && min.z < collider.max.z && max.z > collider.min.z) return true;
    }
    return false;
  }

  function moveBot(bot, dt) {
    const speed = bot.speed;
    const vx = Math.sin(bot.yaw) * -1 * speed * bot.moveSign;
    const vz = Math.cos(bot.yaw) * -1 * speed * bot.moveSign;
    // Strafe: sideways while engaging.
    const strafe = bot.strafe * STRAFE_SPEED;
    const sx = Math.cos(bot.yaw) * strafe;
    const sz = -Math.sin(bot.yaw) * strafe;
    const nextX = bot.position.x + (vx + sx) * dt;
    if (!overlaps(nextX, 0, bot.position.z, HEIGHT, 0.04)) bot.position.x = nextX;
    const nextZ = bot.position.z + (vz + sz) * dt;
    if (!overlaps(bot.position.x, 0, nextZ, HEIGHT, 0.04)) bot.position.z = nextZ;
  }

  function spawn(team, name, position, route, role) {
    const color = team === TEAMS.GARUDA ? '#f0a830' : '#35c4b5';
    const parts = buildSoldier(color);
    scene.add(parts.group);
    const bot = {
      id: bots.length,
      name,
      team,
      role, // patrol | hold | push
      state: 'patrol',
      position: position.clone(),
      yaw: team === TEAMS.GARUDA ? 0 : Math.PI,
      speed: PATROL_SPEED,
      moveSign: 1,
      strafe: 0,
      health: BOT_HEALTH,
      alive: true,
      route: route ? route.map((p) => p.clone()) : [],
      routeIndex: 0,
      target: null, // { kind: 'player' | 'bot', ref, pos }
      burstLeft: 0,
      burstTimer: 0,
      pauseTimer: 0,
      holdTimer: 0,
      investigatePos: null,
      investigateTimer: 0,
      group: parts.group,
      torso: parts.torso,
      head: parts.head,
    };
    parts.torso.userData = { bot, part: 'body' };
    parts.head.userData = { bot, part: 'head' };
    bots.push(bot);
    return bot;
  }

  function spawnAll() {
    spawn(TEAMS.GARUDA, 'Raka', world.spawns.garuda[1], world.attackRoute, 'push');
    spawn(TEAMS.GARUDA, 'Dimas', world.spawns.garuda[2], world.attackRoute, 'push');
    spawn(TEAMS.KOMODO, 'Bayu', world.spawns.komodo[0], world.defendRoutes[0], 'hold');
    spawn(TEAMS.KOMODO, 'Agus', world.spawns.komodo[1], world.defendRoutes[1], 'patrol');
    spawn(TEAMS.KOMODO, 'Eko', world.spawns.komodo[2], world.defendRoutes[2], 'patrol');
    spawn(TEAMS.KOMODO, 'Joko', world.spawns.komodo[3], world.defendRoutes[0], 'patrol');
  }

  function reset(spawns) {
    for (const bot of bots) {
      const spawnPoint = bot.team === TEAMS.GARUDA
        ? spawns.garuda[bot.id === 0 ? 1 : 2]
        : spawns.komodo[bot.id - 2];
      bot.position.copy(spawnPoint);
      bot.yaw = bot.team === TEAMS.GARUDA ? 0 : Math.PI;
      bot.health = BOT_HEALTH;
      bot.alive = true;
      bot.state = 'patrol';
      bot.target = null;
      bot.burstLeft = 0;
      bot.pauseTimer = 0;
      bot.investigatePos = null;
      bot.group.rotation.set(0, bot.yaw, 0);
      bot.group.position.copy(bot.position);
      bot.group.visible = true;
    }
  }

  function hitMeshes() {
    const meshes = [];
    for (const bot of bots) {
      if (!bot.alive) continue;
      meshes.push(bot.torso, bot.head);
    }
    return meshes;
  }

  function canSee(bot, targetPos) {
    _v1.copy(targetPos);
    _v1.y += 1.2;
    _v2.set(bot.position.x, bot.position.y + EYE, bot.position.z);
    const distance = _v1.distanceTo(_v2);
    if (distance > SEE_RANGE) return false;
    _v3.copy(_v1).sub(_v2).normalize();
    _ray.set(_v2, _v3);
    _ray.far = distance;
    const hit = _ray.intersectObjects(world.shootables, false)[0];
    return !hit;
  }

  function faceToward(bot, point) {
    const dx = point.x - bot.position.x;
    const dz = point.z - bot.position.z;
    bot.yaw = Math.atan2(-dx, -dz);
  }

  function pickTarget(bot, env) {
    // Nearest visible enemy: the player (for Komodo) or a Komodo bot (for Garuda).
    let best = null;
    let bestDistance = Infinity;
    const candidates = [];
    if (bot.team === TEAMS.KOMODO && env.playerAlive) {
      candidates.push({ kind: 'player', ref: null, pos: env.playerPos });
    }
    for (const other of bots) {
      if (!other.alive || other.team === bot.team) continue;
      candidates.push({ kind: 'bot', ref: other, pos: other.position });
    }
    for (const candidate of candidates) {
      const distance = bot.position.distanceTo(candidate.pos);
      if (distance < bestDistance && canSee(bot, candidate.pos)) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }

  function fireShot(bot, env) {
    const target = bot.target;
    if (!target) return;
    const muzzle = _v1.set(bot.position.x, bot.position.y + 1.45, bot.position.z);
    _v2.copy(target.pos);
    _v2.y += 1.2;
    const distance = muzzle.distanceTo(_v2);
    const error = 0.02 + distance * 0.0012 + (target.kind === 'player' ? env.playerSpeed * 0.004 : 0.008);
    _v2.sub(muzzle).normalize();
    _v2.x += (random() * 2 - 1) * error;
    _v2.y += (random() * 2 - 1) * error;
    _v2.z += (random() * 2 - 1) * error;
    _v2.normalize();
    _ray.set(muzzle, _v2);
    _ray.far = 80;
    const wallHit = _ray.intersectObjects(world.shootables, false)[0];
    let hitPoint = null;
    let hitDamage = 0;
    let hitPart = null;
    if (target.kind === 'bot') {
      const bodyHit = _ray.intersectObjects([target.ref.torso, target.ref.head], false)[0];
      if (bodyHit && (!wallHit || bodyHit.distance < wallHit.distance)) {
        hitPoint = bodyHit.point;
        hitPart = bodyHit.object.userData.part;
        hitDamage = hitPart === 'head' ? 68 : 34;
      }
    } else {
      // Player: measure how close the shot ray passes to the player's chest.
      _v3.copy(target.pos);
      _v3.y += 1.2;
      _v3.sub(muzzle);
      const along = _v3.dot(_v2);
      const range = target.pos.distanceTo(bot.position);
      const cx = muzzle.x + _v2.x * along;
      const cy = muzzle.y + _v2.y * along;
      const cz = muzzle.z + _v2.z * along;
      const miss = Math.hypot(cx - target.pos.x, cy - (target.pos.y + 1.2), cz - target.pos.z);
      if (along > 0 && along < range + 1 && miss < 0.55 && (!wallHit || wallHit.distance > along)) {
        hitPoint = _v3.set(cx, cy, cz);
        hitDamage = Math.max(12, 34 - range * 0.5);
        hitPart = 'body';
      }
    }
    if (hitPoint) {
      env.tracers.fire(muzzle, hitPoint, bot.team === TEAMS.GARUDA ? '#ffd27a' : '#7adfd4');
      if (target.kind === 'player') env.damagePlayer(hitDamage, bot);
      else env.damageBot(target.ref, hitDamage, hitPart, bot);
    } else if (wallHit) {
      env.tracers.fire(muzzle, wallHit.point, bot.team === TEAMS.GARUDA ? '#ffd27a' : '#7adfd4');
    } else {
      env.tracers.fire(muzzle, _v3.copy(muzzle).addScaledVector(_v2, 40), bot.team === TEAMS.GARUDA ? '#ffd27a' : '#7adfd4');
    }
    env.audio.shot(distance, bot.team === TEAMS.GARUDA);
  }

  function step(dt, env) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.group.position.copy(bot.position);

      // Hearing: a fresh noise nearby pulls a patrolling bot to investigate.
      if (bot.state === 'patrol' || bot.state === 'hold') {
        for (const noise of env.noises) {
          if (env.time - noise.at < 2 && bot.position.distanceTo(noise.pos) < HEAR_RANGE) {
            bot.state = 'investigate';
            bot.investigatePos = noise.pos.clone();
            bot.investigateTimer = 4;
            break;
          }
        }
      }

      // The bomb overrides everything for defenders.
      if (env.bomb.state === 'planted' && bot.team === TEAMS.KOMODO) {
        bot.state = 'defuse';
      }

      // Vision: re-pick a target every step; lose it when it hides.
      const target = pickTarget(bot, env);
      bot.target = target;
      if (target) bot.state = 'engage';

      if (bot.state === 'engage' && target) {
        faceToward(bot, target.pos);
        bot.speed = STRAFE_SPEED;
        bot.strafe = Math.sin(env.time * 1.4 + bot.id * 2.1) > 0 ? 0.7 : -0.7;
        bot.moveSign = 0;
        moveBot(bot, dt);
        bot.pauseTimer -= dt;
        if (bot.burstLeft > 0) {
          bot.burstTimer -= dt;
          if (bot.burstTimer <= 0) {
            fireShot(bot, env);
            bot.burstLeft -= 1;
            bot.burstTimer = 0.13;
          }
        } else if (bot.pauseTimer <= 0) {
          bot.burstLeft = 3 + Math.floor(random() * 3);
          bot.pauseTimer = 0.8 + random() * 0.7;
          bot.burstTimer = 0;
        }
        continue;
      }

      bot.strafe = 0;
      bot.moveSign = 1;
      if (bot.state === 'defuse') {
        bot.speed = 4.0;
        faceToward(bot, new THREE.Vector3(0, 0, -10));
        const site = new THREE.Vector3(0, 0, -10);
        const distance = bot.position.distanceTo(site);
        if (distance > 1.2) {
          const dx = site.x - bot.position.x;
          const dz = site.z - bot.position.z;
          bot.yaw = Math.atan2(-dx, -dz);
          moveBot(bot, dt);
        } else {
          // Channelling the defuse: standing still in the zone.
          env.bomb.defuseProgress += dt;
        }
        continue;
      }
      if (bot.state === 'investigate' && bot.investigatePos) {
        bot.speed = 3.6;
        const dx = bot.investigatePos.x - bot.position.x;
        const dz = bot.investigatePos.z - bot.position.z;
        bot.yaw = Math.atan2(-dx, -dz);
        moveBot(bot, dt);
        if (bot.position.distanceTo(bot.investigatePos) < 1 || (bot.investigateTimer -= dt) <= 0) {
          bot.state = bot.role === 'hold' ? 'hold' : 'patrol';
          bot.investigatePos = null;
        }
        continue;
      }
      if (bot.state === 'hold') {
        // Hold the post: stand at the site edge, scan slowly.
        const post = bot.route[0];
        if (bot.position.distanceTo(post) > 0.5) {
          bot.speed = PATROL_SPEED;
          const dx = post.x - bot.position.x;
          const dz = post.z - bot.position.z;
          bot.yaw = Math.atan2(-dx, -dz);
          moveBot(bot, dt);
        } else {
          bot.yaw += dt * 0.35;
        }
        continue;
      }
      // Patrol / push: follow the route.
      bot.speed = bot.role === 'push' ? PUSH_SPEED : PATROL_SPEED;
      const waypoint = bot.route[bot.routeIndex % bot.route.length];
      if (waypoint) {
        const dx = waypoint.x - bot.position.x;
        const dz = waypoint.z - bot.position.z;
        bot.yaw = Math.atan2(-dx, -dz);
        moveBot(bot, dt);
        if (bot.position.distanceTo(waypoint) < 1.2) bot.routeIndex += 1;
      }
    }
    // Sync visuals.
    for (const bot of bots) {
      bot.group.position.copy(bot.position);
      bot.group.rotation.y = bot.yaw;
    }
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.group.rotation.set(0, bot.yaw, Math.PI / 2);
      bot.group.position.y = 0.25;
      return true;
    }
    return false;
  }

  function aliveCount(team) {
    let count = 0;
    for (const bot of bots) if (bot.alive && bot.team === team) count += 1;
    return count;
  }

  return {
    list: bots,
    spawnAll,
    reset,
    step,
    damage,
    hitMeshes,
    aliveCount,
  };
}
