# WorldSim architecture

This is the plan for the whole game. It explains how the pieces fit together, and
why, so each milestone slots in without rewrites.

## The big idea: three separate layers

```
┌──────────────────────────── Browser tab ─────────────────────────────┐
│                                                                      │
│  MAIN THREAD (the page)                 WEB WORKER (own CPU thread)  │
│  ┌────────────┐  ┌──────────┐           ┌──────────────────────────┐ │
│  │  Renderer  │  │  HUD/UI  │ ◄──────── │       Simulation         │ │
│  │ (PixiJS 2D)│  │  (HTML)  │ snapshots │ terrain, climate, plants │ │
│  └────────────┘  └──────────┘           │ animals, NPCs, economy…  │ │
│        ▲  camera / clicks / speed ────► │ (no screen, no DOM)      │ │
│        │                       commands └──────────────────────────┘ │
└────────┼─────────────────────────────────────────────┬───────────────┘
         │                                             │ (milestone 3+)
         │                                   ┌─────────▼──────────┐
         │                                   │ Node/Express server│
         │                                   │  LLM proxy (.env   │
         │                                   │  holds the API key)│
         │                                   └─────────┬──────────┘
         │                                             ▼
         │                               Claude / OpenAI / Ollama
```

1. **Simulation** (`src/sim`) owns the truth: the world state and the rules. It runs in
   a Web Worker, so heavy thinking never freezes the page. It has no idea how
   anything is drawn.
2. **Renderer** (`src/render`) only draws what the simulation reports. PixiJS today.
   It implements a small `WorldRenderer` interface (`src/render/renderer.ts`), so a
   Three.js renderer can replace it later without touching the simulation.
3. **UI** (`src/ui`) is plain HTML/CSS around the canvas: clock, speed buttons and
   panels.

They talk only through the messages in `src/shared/protocol.ts`:

- page → sim: `init`, `setSpeed`, `viewport` (what the camera sees), `select`
- sim → page: `ready`, `snapshot` (~15 per second)

To move to a real game engine later, port `src/sim` (plain TypeScript with no
browser dependencies) or run it on a server, and keep the same message protocol.

## Folder structure

```
worldsim/
├── index.html              page layout (canvas + HUD elements)
├── package.json            scripts: dev, build, test, typecheck
├── docs/ARCHITECTURE.md    this file
├── tests/                  automated tests (Vitest), run headless, no browser
├── server/                 (milestone 3) Node + Express LLM proxy, .env for API keys
└── src/
    ├── main.ts             wires worker + renderer + HUD together
    ├── style.css
    ├── shared/             pure code used by both sides (no DOM, no Pixi)
    │   ├── protocol.ts     the message contract sim <-> page
    │   ├── terrain.ts      seed-based simplex-noise terrain, biomes, chunks
    │   ├── species.ts      plant & animal definitions (data)
    │   ├── time.ts         calendar, seasons, daylight, temperature curves
    │   └── rng.ts          seeded random numbers (same seed = same world)
    ├── sim/                runs inside the Web Worker
    │   ├── worker.ts       the loop: advance time, generate chunks, post snapshots
    │   ├── world.ts        World class: state + time + chunk/tile queries
    │   ├── state.ts        all saveable state, as plain data
    │   ├── climate.ts      drifting regional weather
    │   ├── snapshot.ts     decides what the page needs and packages it
    │   ├── ecology/        plants.ts, animals.ts
    │   ├── npc/            (m2) needs, routines, families, memory, decisions
    │   ├── society/        (m4) settlements, jobs, economy, tech tree
    │   └── space/          (m6) star systems, planets, rockets
    ├── bridge/simClient.ts the page's handle on the worker
    ├── render/
    │   ├── renderer.ts     the WorldRenderer interface (swap point for 3D)
    │   ├── camera.ts       pan/zoom maths (library-free)
    │   ├── input.ts        mouse/keyboard -> camera (library-free)
    │   ├── palette.ts      biome colours, seasons, terrain painting
    │   └── pixi/           PixiJS-specific: renderer, sprites, day/night & weather
    └── ui/hud.ts           clock, speeds, side panel, tooltip
```

## Key design decisions

**Chunks.** The world is split into 32×32-tile chunks, generated on demand as the
camera approaches. Terrain is a pure function of `(seed, x, y)`, so it is
never saved; it is regenerated on load. What a chunk contains (plants, animals)
is seeded from `(seed, chunkX, chunkY)`, so it doesn't depend on exploration
order.

**Time.** World time is one number: game minutes since the start. One day is 24
game hours. A year is compressed to 4 seasons × 30 days, so generations and
civilisations progress in reasonable play time. Speeds go from 1 game minute
per second up to 10 game years per real minute. At high speed the sim takes
bigger steps. If the computer can't keep up, the sim slows down rather than
freezing, and the HUD shows "⚠ slowed".

**State as plain data.** `WorldState` contains only plain objects and arrays (plus
a few typed arrays and Maps that are easy to encode), which makes saving to
IndexedDB and JSON export/import (milestone 4) straightforward.

**Determinism.** All randomness goes through the seeded RNG stored in the state.
The same seed and the same inputs reproduce the same history, which makes
bugs reproducible.

**Emergence over scripts.** Nothing says "deer population = 50". Populations come out
of needs (hunger, thirst, tiredness), limited food (grass that stops growing in
winter), breeding seasons and death. NPCs follow the same principle, with more
layers.

## How the NPC "brain" will work (milestones 2, 3 and 5)

Each NPC is a utility-AI agent. Every option (eat, sleep, work, socialise,
court, flee…) gets a score from the NPC's needs, personality traits, values,
memories and surroundings, and the NPC does the best-scoring option. That is
cheap enough to run for thousands of NPCs.

The LLM is a *planner and conversationalist*, not a per-tick controller:

| Tier | Who | How they think |
|------|-----|----------------|
| **A: focus** | NPCs near the camera or in conversation | utility AI every tick + LLM for big life decisions ("should I marry Ana?", "start a farm?") and all chat |
| **B: active** | the rest of the loaded area | utility AI only |
| **C: abstract** | far away / other settlements | statistical simulation per household/settlement (births, deaths, production) in coarse steps |

When an NPC moves between tiers, its full state (needs, memories, relationships,
goals) is preserved. Tier C is reconstructed into individuals when the player
arrives. LLM requests go through a queue with a **max-calls-per-minute** setting
and a cache, and fall back to rules/canned replies if the server is unavailable.
The LLM's output is only *advice* the simulation validates (it can't teleport
anyone or create gold).

Memory stays small: a short event log (last ~20 events) plus a handful of
summarised long-term memories, compressed by the LLM (or by rules offline)
when the log fills up.

## Milestones

1. ✅ **Procedural world.** Chunked terrain with biomes and rivers, camera pan/zoom,
   day/night, seasons, regional weather, growing and spreading plants, deer
   with needs and population dynamics.
2. **People.** 10 NPCs with identity, needs, daily routines (sleep/eat/work/socialise),
   families and life cycle. No LLM yet.
3. **Minds.** Node/Express server proxying an LLM. Click an NPC to chat; replies use
   personality, mood, needs and memories; conversations are remembered.
   Offline fallback.
4. **Civilisation.** Settlements (camp → village → town → city), jobs, crafting, trade,
   money, tech tree start, IndexedDB autosave plus JSON export/import.
5. **Scale.** Tiered simulation, spatial indexing and abstract far-away settlements,
   aiming at thousands of NPCs. Minimap, timeline and world stats.
6. **Space.** Rocketry tech, procedural star systems and planets (gravity, atmosphere,
   temperature, water → habitability), zoomable star map, colonies.

## Honest limits (and the workable versions)

- **"Endless" world.** Terrain is infinite, but every *visited* chunk's living
  contents use memory. Milestone 5 freezes distant chunks into compact summaries
  that catch up ("8 years passed: the forest grew, the herd moved") when revisited.
- **LLM for everyone.** Real-time LLM thinking for thousands of NPCs is not
  practical on cost or speed. The tiered design gives the *feel* of it: the
  people you look at are deep, and the rest are believable.
- **"As realistic as possible."** We use simplified models that behave realistically,
  such as seasons, food limits and lifespans. These are not scientific models.
  Time is compressed, so a year is 120 days.
- **Space.** Orbital mechanics will be simplified (no n-body physics). Planets are
  generated on demand, which keeps exploration endless.
- **Browser storage.** IndexedDB normally allows hundreds of MB, plenty for
  saves if we store only what can't be regenerated from the seed.
