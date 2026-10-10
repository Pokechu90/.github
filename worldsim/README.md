# WorldSim

A living, procedurally generated world in your browser. People have their own
personalities, needs, families, jobs, memories and opinions. They farm, trade,
fall in love, catch diseases, found new villages, invent technology, and
eventually go to space and colonise other planets. The world keeps going
whether or not you're watching, and you can talk to anyone in it.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it all fits together.

---

## 1. Run it on your computer

You need **Node.js 20.19 or newer** (22 LTS recommended) from https://nodejs.org.

```bash
cd worldsim
npm install        # first time only
npm run dev        # starts the game AND the NPC "brain" server
```

Open **http://localhost:5173**. Press `Ctrl+C` in the terminal to stop.

### Give the NPCs real minds (optional)

Without an LLM, NPCs answer with simple built-in replies. To let them think
and talk for real:

1. Copy `.env.example` to a new file called `.env` (same folder).
2. Paste an API key into it:
   - **Claude** (default): `ANTHROPIC_API_KEY=...` from https://console.anthropic.com
   - or **OpenAI**: set `LLM_PROVIDER=openai` and `OPENAI_API_KEY=...`
   - or **free and local**: install [Ollama](https://ollama.com), run `ollama pull llama3.1`,
     then set `LLM_PROVIDER=ollama`
3. Restart `npm run dev`. The 🧠 button in the top bar turns gold when it's connected.

The key stays in `.env` on your computer and is only read by the server. It is
never sent to the browser. In the 🧠 dialog you can set the **maximum LLM calls per
minute** (to control cost), and whether the LLM may plan goals for people near the camera.

The default model is Claude Opus 5.5. For cheaper conversations set
`CLAUDE_MODEL=claude-sonnet-5-5` or `claude-haiku-5-5` in `.env`.

### Other commands

| Command | What it does |
|---|---|
| `npm test` | Automated tests (terrain, ecology, people, civilisation, save/load, space) |
| `npm run typecheck` | Checks the code for errors |
| `npm run build` | Builds a static website in `dist/` |
| `npm run game` / `npm run server` | Start only the game, or only the brain server |

---

## 2. Play it on the web

The game is a static website. The simulation runs entirely in the browser, so
it can be hosted anywhere for free. When hosted without the brain server, NPCs
use offline replies (or you can point the 🧠 settings at a server you run).

**On claude.ai:** the game is also published as a Claude artifact (ask the owner
for the link). There, NPC conversations use the *viewer's own* Claude account
(the page asks for permission the first time you talk to someone), so no
server or API key is needed, and 💾 Export asks before saving the file.

**GitHub Pages:** this repository includes a workflow,
`.github/workflows/worldsim-pages.yml`, that tests, builds and publishes the
game whenever `worldsim/` changes on `main`. Enable it once in the repository's
**Settings → Pages → Source: GitHub Actions**. Tip: Pages works best from a
normal repository name (e.g. move this folder to a repo called `worldsim` →
`https://<you>.github.io/worldsim/`).

**Any static host** (Netlify, Vercel, Cloudflare Pages, itch.io): run `npm run build`
and upload the `dist/` folder.

**Hosting the brain server** for an online game: deploy `server/` to any Node host
(Render, Railway, Fly.io), set the API key there, and set `ALLOWED_ORIGIN` to your
game's address. Players then enter the server address in the 🧠 settings.

---

## 3. Controls

| Input | Action |
|---|---|
| Drag, or W A S D / arrows | Move the camera |
| Mouse wheel, + / − | Zoom (far out = map view with town names) |
| Click | Inspect a person, building, town, animal or plant |
| Esc | Deselect / stop following |
| Space · 1–5 | Pause · speeds 1×, 10×, 60×, 1 year/min, 10 years/min |
| 💬 Talk (person panel) | Chat with them. Type anything; they answer in character |
| 📍 Follow / 🎯 Find | Camera follows a person / jumps to them |
| Minimap (bottom left) | Click to jump, scroll to zoom |
| 🪐 Space | Star map → solar systems → planet surfaces |
| 💾 Save | Save, load, export/import a `.json` file. Autosaves every 3 minutes |

**Worlds are seeds:** `?seed=42` in the address always makes the same world.
**Sandbox:** add `&sandbox=space` to start with every technology and a launch pad
(or `&sandbox=modern` for the computer age), to try the late game straight away.

---

## 4. What's in the world

**Nature.** Endless terrain in chunks (oceans, rivers, forests, deserts, tundra,
mountains) with day/night, seasons, drifting regional weather, snow and frozen
lakes. Trees and plants grow, fruit by season, spread, compete and die. Deer graze,
drink, herd, breed in autumn and starve in hard winters. Herds recolonise empty land.

**People.** Each person has a name, look, Big Five personality, values, skills, a
job, needs (hunger, tiredness, loneliness, fear, boredom), health, mood and an
inner thought. A utility-AI "brain" chooses what to do from all of that. People:
- **Live in families:** they court, fall in love, marry, sometimes split up, and
  have children who inherit their looks and temperament. Orphans are taken in.
- **Remember** what happens to them (short-term and lasting memories) and gossip,
  so news spreads by word of mouth and each person only knows what they saw or heard.
- **Work:** foraging, hunting, fishing, woodcutting, building, farming, crafting,
  healing, teaching, research, trade. Children learn from their parents and elders.
- **Get sick:** colds, fevers, dysentery, pox and plague spread through homes and
  towns. Survivors gain immunity; healers, medicine, quarantine laws and warm
  clothing help.
- **Die** of old age, hunger, disease, childbirth, raids, or accidents in space.

**Talking to people.** Your words, their reply and how they felt about it go into
their memory. They may lie, refuse, joke or get annoyed. What you say can change
their plans, and they tell others about you.

**Civilisation.** Settlements grow from camp → village → town → city → metropolis.
Technology runs from stone tools through agriculture, writing, currency,
metalwork, printing, industry, electricity and computing to rocketry and warp
drive. Ideas come from practising skills and from scholars, and spread through
trade and migration. There are prices from supply and demand, wages, traders,
leaders chosen by respect, laws shaped by the leader's personality, culture,
crime, diplomacy and raids. Crowded or hungry towns send groups off to found new
villages; newcomers arrive from beyond the map.

**Space.** Astronomy charts the planets; rockets send probes, then crews, then
interstellar probes and colony ships. Stars and planets are generated from the seed
(gravity, atmosphere, temperature, water → habitability), so the galaxy never ends.
Colonies grow according to their planet and send ships of their own.

---

## 5. Honest limits

- **Time is compressed:** a year has 120 days, so generations and history unfold in
  hours of play rather than years.
- **Scale is tiered:** people near the camera are simulated minute by minute;
  distant towns run as a daily aggregate; very large cities keep part of their
  population as statistics; at 1+ year/minute everything is aggregate. This is how
  a browser handles thousands of people.
- **LLM minds cost money:** they only run for conversations and for people near
  the camera, within your per-minute limit. Everyone else uses the rules-based
  brain, which is always running.
- **Space colonies are simulated as populations**, not as full worlds you can walk
  around (yet). The planet surface view is a generated map.
- **Real-world realism is approximate:** models of disease, economy and physics
  are simplified to behave plausibly, not to be scientifically exact.
