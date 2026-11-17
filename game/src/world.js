// The map: Pelabuhan Tua, an old harbour yard at dusk. One original arena, built
// from boxes only: a container yard with three lanes into Site A, a warehouse alley
// on the west, an open dock on the east. Every box is both a collider and a surface
// a bullet stops on. No model, texture or name is taken from another game.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: name === 'steel' ? 0.55 : 0.03,
    });
  }

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Yard floor, 40 x 30 m, and 5 m perimeter walls.
  box(40.4, 0.4, 30.4, 0, -0.2, 0, 'ground');
  box(0.4, 5, 30.4, -20.2, 2.5, 0, 'wall');
  box(0.4, 5, 30.4, 20.2, 2.5, 0, 'wall');
  box(40.4, 5, 0.4, 0, 2.5, -15.2, 'wall');
  box(40.4, 5, 0.4, 0, 2.5, 15.2, 'wall');

  // Site A: a marked 6 x 6 m plant zone at the north end, ringed by containers.
  const sitePlate = box(6, 0.08, 6, 0, 0.04, -10, 'hazard');
  sitePlate.material = materials.hazard.clone();
  sitePlate.material.transparent = true;
  sitePlate.material.opacity = 0.55;
  box(6.1, 2.6, 1.2, -3.6, 1.3, -13.2, 'amber');
  box(6.1, 2.6, 1.2, 3.6, 1.3, -13.2, 'teal');
  box(1.2, 2.6, 6.1, -6.6, 1.3, -10, 'rust');
  box(1.2, 2.6, 6.1, 6.6, 1.3, -10, 'rust');
  // A low stack inside the site to crouch behind while planting.
  box(2.4, 1.1, 1.2, -1.8, 0.55, -8.2, 'crate');
  box(2.4, 1.1, 1.2, 2.2, 0.55, -11.6, 'crate');

  // Mid lane: staggered container stacks force two corners before the site.
  box(6.1, 2.6, 2.4, -5, 1.3, -4.5, 'teal');
  box(6.1, 2.6, 2.4, 5, 1.3, -4.5, 'amber');
  box(2.4, 2.6, 2.4, 0, 1.3, -0.5, 'rust');
  box(1.2, 1.1, 1.2, -8.5, 0.55, 0.5, 'crate');
  box(1.2, 1.1, 1.2, 8.5, 0.55, 0.5, 'crate');
  box(2.4, 1.1, 1.2, -2.5, 0.55, 4, 'crate');
  box(2.4, 1.1, 1.2, 2.5, 0.55, 4, 'crate');

  // West alley: a warehouse block with a covered lane behind it.
  box(8, 4.2, 6, -16, 2.1, -6, 'warehouse');
  box(1.2, 1.1, 1.2, -12.5, 0.55, -11, 'crate');
  box(1.2, 1.1, 1.2, -12.5, 0.55, 2, 'crate');
  box(2.4, 1.1, 1.2, -16, 0.55, 6, 'crate');

  // East dock: open sightline, low crates, a gantry crane silhouette.
  box(1.2, 1.1, 1.2, 12.5, 0.55, -8, 'crate');
  box(1.2, 1.1, 1.2, 12.5, 0.55, 8, 'crate');
  box(2.4, 1.1, 1.2, 16, 0.55, 0, 'crate');
  box(0.8, 9, 0.8, 17.5, 4.5, -12, 'steel');
  box(0.8, 9, 0.8, 17.5, 4.5, -4, 'steel');
  box(0.7, 0.7, 8.7, 17.5, 8.8, -8, 'steel');

  // South spawn cover for the attackers.
  box(2.4, 1.1, 1.2, -4, 0.55, 11, 'crate');
  box(2.4, 1.1, 1.2, 4, 0.55, 11, 'crate');

  // Dusk light: a low warm sun from the west, cool sky fill, thin fog.
  const sky = new THREE.HemisphereLight(new THREE.Color('#8a7a68'), new THREE.Color(PALETTE.canvas), 0.9);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb45e'), 2.4);
  sun.position.set(-18, 10, 6);
  sun.target.position.set(4, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#5f7ea6'), 0.5);
  fill.position.set(10, 12, 12);
  scene.add(fill);

  // Site A plant zone (y 0..3, so a standing player counts).
  const siteZone = new THREE.Box3(
    new THREE.Vector3(-3, 0, -13),
    new THREE.Vector3(3, 3, -7),
  );

  return {
    colliders,
    shootables,
    group,
    siteZone,
    spawns: {
      garuda: [
        new THREE.Vector3(-2, 0, 12.5),
        new THREE.Vector3(0, 0, 13),
        new THREE.Vector3(2, 0, 12.5),
      ],
      komodo: [
        new THREE.Vector3(-8, 0, -12),
        new THREE.Vector3(-2, 0, -12.5),
        new THREE.Vector3(4, 0, -12.5),
        new THREE.Vector3(9, 0, -11),
      ],
    },
    // Defender patrol loops: around the site, through mid, and down the dock.
    defendRoutes: [
      [new THREE.Vector3(-4, 0, -7), new THREE.Vector3(4, 0, -7), new THREE.Vector3(4, 0, -12), new THREE.Vector3(-4, 0, -12)],
      [new THREE.Vector3(-10, 0, -2), new THREE.Vector3(0, 0, -4), new THREE.Vector3(10, 0, -2), new THREE.Vector3(0, 0, -8)],
      [new THREE.Vector3(14, 0, -6), new THREE.Vector3(14, 0, 6), new THREE.Vector3(8, 0, 2)],
    ],
    // Attacker push route: south spawn, mid, then the site.
    attackRoute: [
      new THREE.Vector3(0, 0, 8),
      new THREE.Vector3(-2, 0, 2),
      new THREE.Vector3(0, 0, -4),
      new THREE.Vector3(0, 0, -9),
    ],
  };
}
