# Yoink repository instructions for AI agents

This small project powers **YOINK**, a fast-paced shared‑pool word game. The
codebase is split into a frontend React/Vite app and a backend Node/Express
socket.io server. There is *no README* in the repo, so you should rely on the
contents of the two top‑level folders to understand how things work.

---
## High‑level architecture

- `client/` – a Vite‑powered React+TypeScript single‑page app.  It can run
  entirely offline (see *offline simulation* below) or talk to the server via
  `socket.io-client`.
- `server/` – a simple real‑time Node service.  The current implementation lives
  in TypeScript under `server/src/*.ts` and is compiled to `server/dist` with
  `tsc`.  There is also an older JavaScript version (`server/index.js`) that
  mostly duplicates the logic; new work should focus on the TypeScript files.

Both halves are intentionally self‑contained.  State synchronization is handled
entirely over socket.io events.  The client mirrors several helper functions
(`scoreWord`, letter bag generation, rate‑limiting, etc.) so that the offline
mode behaves exactly like the live game.

### Data flow & game rules

- Players join a room and automatically trigger a round start when the room is
  idle (`lobby:join`).
- Tiles drip in from a shuffled bag; the server keeps a `pool` record of counts
  and reveals a fixed number each second.  Clients display a random ordering of
  the current pool.
- Words are submitted with `word:submit`; the server batches them in a
  short (150 ms) "shadow window" to ensure fairness and avoids binding them to
  the authoritative pool until the window closes.
- Duplicate‑word behaviour is controlled by `settings.uniqueWords` with three
  modes.  Decay models (`linear`, `soft`, `steep`) are applied at round end.
- The dictionary comes from one or more URLs defined by `WORDLIST_URLS` (comma
  separated); a tiny fallback is used if the fetch fails.

For concrete examples, study `server/src/server.ts` (room/round lifecycle) and
`client/src/App.tsx` (offline logic and event handling).

---
## Developer workflows

### Running the client

```bash
cd client
npm install      # or yarn / pnpm
npm run dev       # starts Vite on 5173
```

- The build uses `vite build`; the preview server listens on port 5174.
- Set `VITE_SOCKET_URL` in `.env` (e.g. `http://localhost:5177`) to connect to
the backend.  If the variable is unset or the connection fails quickly, the app
falls back to offline simulation.
- Tailwind is configured via `tailwind.config.ts`; styles live in
  `src/styles.css`.

### Running the server

```bash
cd server
npm install
npx tsc           # produces JS in dist/
node dist/server.js   # or simply `node index.js` for the JS fallback
```

- `PORT` environment variable (default 5177) controls the listen port.
- `WORDLIST_URLS` is a comma‑separated list of raw text files (one word per
  line) used to build the dictionary.  If omitted, the code fetches a default
  wordnik list.
- There are no automated tests yet; manual playtesting via the UI is how bugs
  are discovered.

### Common commands

| Directory | Task               | Command                     |
|-----------|--------------------|-----------------------------|
| client    | dev server         | `npm run dev`               |
| client    | build for prod     | `npm run build`             |
| server    | compile TS         | `npx tsc`                   |
| server    | start (JS version) | `node index.js`             |

> ⚠️ There is no linting/formatting configuration in the repo.  Follow general
> TypeScript/React idioms and keep log statements minimal.

---
## Project‑specific conventions

- **Shadow window**: submissions are buffered in `Map<number, Submission[]>`
  keyed by `nowWindowKey(ts, shadowWindowMs)`; `processShadowWindow` applies a
  snapshot of the pool and performs validation in chronological order.
- **Public state**: the server only emits a pared‑down view of `RoomState` via
  `publicState(r)`; clients should never depend on hidden fields.
- Client and server both implement a token‑bucket rate limiter (5 req/s burst
  10) to keep UI behaviour consistent offline and online.
- Settings updates are partially applied (only certain fields) and clamp values
  (e.g. `durationSec` between 30–600).  When adjusting settings, the server
  resets `surgeAmount` to 10 for the next round.
- Words must be uppercase A–Z; submissions violating this are discarded without
  response (``success-only feed``).
- Several constants (POINTS, COUNTS, scoring formulas) are duplicated in
  `client/lib/scoring.ts` for visualization; update both when changing rules.

---
## Integration points

- Socket.io events used by the client/server:
  `lobby:join`, `lobby:state`, `word:submit`, `word:accepted`, `round:ended`,
  `settings:update`, `game:start` (+ the backup names in the JS server
  version).  Room codes are arbitrary strings (usually 4‑character codes).
- No external services are required except for optional wordlist URLs.  The
  `https` module is used to fetch text files during server startup.
- The client build is static and can be served by any HTTP server; the server
  itself currently exposes only the socket.io endpoint and a simple health
  check on `/`.

---
## Notes for agents

- No tests or continuous integration are present; rely on reading real code and
  manually verifying behaviour by running `npm run dev` + server.  Confirm any
  feature changes by playing a round in the browser (offline mode is useful for
  quickly iterating without a server).
- New features should update both client and server where logic is mirrored
  (scoring, pool handling, rate limiting).
- When editing server TypeScript, remember to compile (`tsc`) before running or
  adjust `server/index.js` if you're tinkering with the legacy JS version.
- Pay attention to `server/tsconfig.json` and the `module: "ES2022"` setting
  if you introduce new syntax.

> 🔁 After modifying event names or payloads, update the matching listeners in
> `client/src/App.tsx` and the corresponding server handlers.


Please review these instructions and let me know if any part of the workflow or
architecture is unclear or missing so we can iterate.