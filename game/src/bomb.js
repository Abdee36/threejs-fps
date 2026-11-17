// The bomb: Site A is the only objective beyond killing. The player carries the
// device; holding E inside the marked zone channels the plant. Once it is down,
// a 35-second fuse runs and the defenders rush in to defuse. Taking damage while
// channelling a defuse wipes the defuse progress.
import { PLANT_TIME, DEFUSE_TIME, BOMB_TIME, ECONOMY } from './state.js';

export function createBomb(world, state) {
  const zone = world.siteZone;

  function playerInZone(playerPos) {
    return zone.containsPoint(playerPos);
  }

  return {
    // Called every fixed step while the round runs. Returns an event string or null.
    step(dt, player, keys, audio) {
      const bomb = state.bomb;
      if (bomb.state === 'carried') {
        const planting = player.alive && keys.has('KeyE') && playerInZone(player.position);
        if (planting) {
          bomb.plantProgress += dt;
          audio.plantTick(bomb.plantProgress);
          if (bomb.plantProgress >= PLANT_TIME) {
            bomb.state = 'planted';
            bomb.timer = BOMB_TIME;
            bomb.plantProgress = 0;
            state.money += ECONOMY.plantReward;
            state.feed.unshift({ text: `Perangkat ditanam di Site A (+${ECONOMY.plantReward})`, kind: 'bomb', at: 0 });
            audio.planted();
            return 'planted';
          }
        } else {
          bomb.plantProgress = Math.max(0, bomb.plantProgress - dt * 2);
        }
        return null;
      }
      if (bomb.state === 'planted') {
        bomb.timer -= dt;
        audio.fuseBeep(bomb.timer);
        if (bomb.defuseProgress >= DEFUSE_TIME) {
          bomb.state = 'defused';
          return 'defused';
        }
        if (bomb.timer <= 0) {
          bomb.state = 'detonated';
          return 'detonated';
        }
      }
      return null;
    },
    reset() {
      state.bomb.state = 'carried';
      state.bomb.plantProgress = 0;
      state.bomb.defuseProgress = 0;
      state.bomb.timer = 0;
      state.bomb.defuser = null;
    },
    inZone(playerPos) {
      return playerInZone(playerPos);
    },
  };
}
