# WorldSim

A living, procedurally generated world that runs in your browser. Today it
has terrain, weather, seasons, plants and deer. Later milestones add people
with minds, then civilisations, then space travel.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full plan.

## Running it

You need **Node.js 20.19 or newer** (22 LTS recommended) from https://nodejs.org.
Check your version with `node -v`.

```bash
cd worldsim
npm install        # first time only: downloads the libraries (~1 minute)
npm run dev        # starts the game
```

Then open **http://localhost:5173** in Chrome, Edge or Firefox. Press `Ctrl+C` in
the terminal to stop it. When you edit code, the page reloads by itself.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs automated tests, including simulating 8 years of ecology without a browser |
| `npm run typecheck` | Checks the code for type errors |
| `npm run build` | Makes an optimised version in `dist/` you can host anywhere |

## Controls

| Input | Action |
|---|---|
| Drag, or W A S D / arrow keys | Move the camera |
| Mouse wheel, or + / − | Zoom (zoom far out to see the terrain map) |
| Click | Inspect an animal or plant (needs, age, memory) |
| Hover | See the biome, coordinates and average temperature of a tile |
| Space | Pause / resume |
| 1–5 | Speed: 1×, 10×, 60×, 1 year/min, 10 years/min |
| "New world" | Generate a new random world |

Each world comes from a **seed** in the URL (e.g. `?seed=42`). The same seed always
creates the same world, so you can share one with a friend.

## What's in milestone 1

- **Endless terrain** generated in 32×32 chunks as you explore. Oceans, beaches,
  grassland, forest, taiga, tundra, savanna, desert, swamp, mountains, snowy
  peaks and winding rivers.
- **Time.** Smooth day/night with warm dawns and dusks. Days are longer in
  summer. There are four seasons (a year is compressed to 120 days).
- **Weather.** Rain fronts drift across the map, so it can rain in one valley and
  not the next. Snow falls when it's cold, the snow line moves with the seasons,
  and lakes and rivers freeze in cold winters.
- **Plants.** Oak, pine, apple trees, berry bushes, wild wheat and cacti. They grow
  from seed to sapling to mature to old, then die and leave a standing dead tree
  for a while. Leaves change colour and fall, fruit ripens in season, plants
  spread seeds and compete for space, and frost hurts them.
- **Deer.** Each deer has hunger, thirst and tiredness. They drink at rivers and
  lakes and remember where water is. They graze, eat fruit, sleep at night and
  stay with their herd. They mate in autumn, fawns are born in late spring
  or early summer and follow their mother, and deer die of starvation, thirst or old age.
  Grass is limited and stops growing in winter, so populations rise and fall
  naturally. Watch the graph in the side panel.

## Testing milestone 1 yourself

1. Run `npm run dev` and open the page. You should see land, trees and the clock
   ticking from 06:00 on Spring 1.
2. Zoom in on some deer (they're brown) and click one. The side panel shows its
   needs. Watch it go and drink when thirst gets high.
3. Press **4** (1 year per minute) and watch the land and trees change through
   summer, autumn and winter. Watch night fall.
4. Press **5** (10 years per minute) for a minute or two. The deer graph rises and
   falls, and "Births" and "Died of …" go up in the World panel.
5. Zoom far out. Plants hide and you see the terrain map. Drag around to explore
   and new land generates.
6. Run `npm test`. All tests should pass.
