# Senja Strike — Operasi Pelabuhan Tua

A round-based tactical FPS in three.js, built for make.fun's threejs-fps-02 bounty.
Tim Garuda (you plus two allies) attacks Site A against four Komodo defenders in
an old harbour yard at dusk. First team to 5 round wins takes the match.

## How a round works

- **Buy phase (15 s):** spend the money you earned on weapons, a grenade, or
  armour. Pistol is free; Kancil-9 SMG $1,200; AR-21 Garuda rifle $2,700;
  Elang-50 sniper $4,000; HE grenade $300; armour $650.
- **Round (100 s):** eliminate the other team, or plant the device at Site A
  (hold E inside the marked zone for 3 s) and defend it for 35 s until it
  detonates. Defenders can defuse it (5 s channel, damage interrupts).
- **Economy:** kill +$300, round win +$1,000, round loss +$500, plant +$300.

## Controls

WASD move · mouse look · click fire · R reload · 1–4 switch weapon ·
E plant (hold, in Site A) · G throw grenade · Ctrl crouch (steadier aim) ·
Space jump · B buy menu (buy phase) · Enter start round early.

Gunplay rewards stopping to aim: spread and recoil grow while moving and with
every shot, and shrink when you crouch or stand still. Headshots deal double.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots: `?shot=start|play|end&seed=1` renders a deterministic frame.

## Structure

- `game/index.html` — page, HUD, overlays, import map for three.js 0.187.0.
- `game/src/main.js` — boot, fixed-step loop, shooting, shot modes.
- `game/src/world.js` — the Pelabuhan Tua map (lanes, Site A, cover).
- `game/src/player.js` — movement, collision, health, armour.
- `game/src/weapons.js` — four guns, grenade, tracers.
- `game/src/bots.js` — bot soldiers and their AI (patrol, hold, engage,
  investigate, defuse).
- `game/src/bomb.js` — plant / defuse / detonation.
- `game/src/rounds.js` — round flow and economy.
- `game/src/audio.js` — synthesised WebAudio sound, no audio files.
- `game/src/hud.js` — HUD, buy menu, killfeed, overlays.
- `game/src/state.js` — the one game state, weapon and economy tables.
- `game/src/palette.js`, `game/src/util.js`, `game/src/input.js` — shared bits.
- `main.ts` — the entrypoint: copies game/ + screenshots/ to /output and
  writes dossier.json.
