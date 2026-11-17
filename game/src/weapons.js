// Weapons: four original guns plus a grenade. Each gun is a small procedural view
// model on the camera, a magazine, a reload, and the spread that punishes firing
// on the move. Bloom grows with every shot and while moving, and shrinks when the
// player stops and aims: stopping to aim pays. Tracers are a fixed pool, reused.
import * as THREE from 'three';
import { WEAPONS } from './state.js';
import { clamp } from './util.js';

const MODEL_STYLE = {
  pistol: { color: '#2c2f36', accent: '#f0a830', barrel: 0.24, grip: 0.16 },
  smg: { color: '#33363d', accent: '#35c4b5', barrel: 0.34, grip: 0.2 },
  rifle: { color: '#3a3d44', accent: '#f0a830', barrel: 0.46, grip: 0.22 },
  sniper: { color: '#23262c', accent: '#7dc383', barrel: 0.62, grip: 0.24 },
};

export function createArsenal(camera) {
  const models = {};
  for (const [id, style] of Object.entries(MODEL_STYLE)) {
    const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.color), roughness: 0.5, metalness: 0.4 });
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.accent), roughness: 0.5, metalness: 0.3 });
    const group = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4), body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, style.barrel), body);
    barrel.position.set(0, 0.03, -0.2 - style.barrel / 2);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, style.grip, 0.08), accent);
    grip.position.set(0, -0.08, 0.14);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.06), accent);
    sight.position.set(0, 0.075, -0.1);
    group.add(receiver, barrel, grip, sight);
    group.position.set(0.24, -0.2, -0.42);
    group.visible = false;
    camera.add(group);
    models[id] = group;
  }

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb45e'), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.17, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color('#ffb45e'), 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = {
    current: 'pistol',
    mag: WEAPONS.pistol.mag,
    reserve: WEAPONS.pistol.reserve,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    bloom: 0,
    bob: 0,
  };

  function def() {
    return WEAPONS[state.current];
  }

  function showModel() {
    for (const [id, group] of Object.entries(models)) group.visible = id === state.current;
  }
  showModel();

  function step(dt, speed, crouched) {
    const d = def();
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    // Bloom: each shot adds, moving adds, crouching and standing still bleed it off.
    const target = clamp(speed / 5.2, 0, 1) * (crouched ? 0.4 : 1) * 0.02;
    state.bloom += (target - state.bloom) * Math.min(1, dt * (speed > 0.5 ? 6 : 3));
    state.bob += dt * (2 + speed * 1.6);
    const model = models[state.current];
    model.position.z = -0.42 + state.kick;
    model.position.y = -0.2 + Math.sin(state.bob) * 0.006 * Math.min(1, speed / 5.2);
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 16 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (d.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = d.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  return {
    state,
    def,
    step,
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    select(id) {
      if (!WEAPONS[id] || id === 'grenade' || id === state.current) return false;
      state.current = id;
      const d = WEAPONS[id];
      state.mag = d.mag;
      state.reserve = d.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.bloom = 0;
      showModel();
      return true;
    },
    // Keep the mag/reserve a weapon had when the player switches away and back.
    stash() {
      return { id: state.current, mag: state.mag, reserve: state.reserve };
    },
    restore(stash) {
      if (!stash || stash.id === state.current) return;
      state.current = stash.id;
      state.mag = stash.mag;
      state.reserve = stash.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      showModel();
    },
    pullTrigger() {
      const d = def();
      state.cooldown = d.gap;
      state.flash = 0.06;
      state.kick = 0.055;
      state.bloom = Math.min(0.05, state.bloom + d.spreadStill * 2.2);
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      const d = def();
      if (state.reloadLeft > 0 || state.mag === d.mag || state.reserve === 0) return;
      state.reloadLeft = d.reload;
    },
    spread(speed, crouched) {
      const d = def();
      const moving = clamp(speed / 5.2, 0, 1) * (crouched ? 0.45 : 1);
      return d.spreadStill + moving * d.spreadMove + state.bloom;
    },
    refill() {
      const d = def();
      state.mag = d.mag;
      state.reserve = d.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.bloom = 0;
    },
  };
}

// One live grenade at a time: a thrown sphere that arcs, bounces once, then bursts.
export function createGrenadeSystem(scene) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#23262c'), roughness: 0.4, metalness: 0.6 }),
  );
  mesh.visible = false;
  scene.add(mesh);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb45e'), transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(flash);
  const light = new THREE.PointLight(new THREE.Color('#ff9040'), 0, 14);
  scene.add(light);

  const state = {
    active: false,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    fuse: 0,
    burst: 0,
    bounced: false,
  };

  return {
    state,
    throwFrom(origin, direction) {
      if (state.active) return false;
      state.active = true;
      state.position.copy(origin);
      state.velocity.copy(direction).multiplyScalar(16);
      state.velocity.y += 4.5;
      state.fuse = WEAPONS.grenade.fuse;
      state.burst = 0;
      state.bounced = false;
      mesh.visible = true;
      mesh.position.copy(origin);
      return true;
    },
    // Returns the explosion centre when the fuse blows, else null.
    step(dt) {
      if (!state.active) return null;
      state.fuse -= dt;
      state.velocity.y -= 14 * dt;
      state.position.addScaledVector(state.velocity, dt);
      if (state.position.y < 0.09) {
        state.position.y = 0.09;
        if (!state.bounced) {
          state.velocity.y = Math.abs(state.velocity.y) * 0.35;
          state.velocity.x *= 0.6;
          state.velocity.z *= 0.6;
          state.bounced = true;
        } else {
          state.velocity.set(0, 0, 0);
        }
      }
      mesh.position.copy(state.position);
      if (state.burst > 0) {
        state.burst -= dt;
        const t = 1 - Math.max(0, state.burst) / 0.35;
        flash.scale.setScalar(1 + t * WEAPONS.grenade.radius);
        flash.material.opacity = Math.max(0, 0.85 * (1 - t));
        light.intensity = Math.max(0, 40 * (1 - t));
        if (state.burst <= 0) {
          flash.material.opacity = 0;
          light.intensity = 0;
          state.active = false;
          mesh.visible = false;
        }
        return null;
      }
      if (state.fuse <= 0) {
        state.burst = 0.35;
        flash.position.copy(state.position);
        flash.scale.setScalar(1);
        flash.material.opacity = 0.85;
        light.position.copy(state.position);
        light.intensity = 40;
        mesh.visible = false;
        return state.position.clone();
      }
      return null;
    },
  };
}

// Tracers: a fixed pool of line segments, recycled, so gunfire never allocates.
export function createTracers(scene) {
  const pool = [];
  for (let i = 0; i < 12; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: new THREE.Color('#ffd27a'), transparent: true, opacity: 0 }),
    );
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    pool.push({ line, life: 0 });
  }
  let next = 0;

  return {
    fire(from, to, color = '#ffd27a') {
      const slot = pool[next];
      next = (next + 1) % pool.length;
      slot.line.material.color.set(color);
      const positions = slot.line.geometry.attributes.position.array;
      positions[0] = from.x; positions[1] = from.y; positions[2] = from.z;
      positions[3] = to.x; positions[4] = to.y; positions[5] = to.z;
      slot.line.geometry.attributes.position.needsUpdate = true;
      slot.line.visible = true;
      slot.life = 0.09;
    },
    step(dt) {
      for (const slot of pool) {
        if (slot.life <= 0) continue;
        slot.life -= dt;
        slot.line.material.opacity = Math.max(0, slot.life / 0.09);
        if (slot.life <= 0) slot.line.visible = false;
      }
    },
  };
}
