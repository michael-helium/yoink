import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { loadWordlists } from "./dict";
import {
  scoreYoinkGrid, countTiles, YOINK_BONUS, YOINK_PENALTY,
  scoreYoinkWord, weightedRandomLetter, spawnIntervalMs, YOINK_POINTS, ROUND_MULTIPLIERS
} from "./yoink-scoring";

// ===== Types =====
type UniqueWordsMode = "disallow" | "allow_no_penalty" | "allow_with_decay";
type DecayModel = "linear" | "soft" | "steep";
type GameMode = "classic" | "yoink";
type Phase = "lobby" | "playing" | "intermission" | "finished";

type Settings = {
  gameMode: GameMode;
  durationSec: number;            // classic mode duration (default 120)
  minLen: number;                 // 2–6 (default 3)
  uniqueWords: UniqueWordsMode;   // classic mode
  decayModel: DecayModel;         // classic mode
  revealModel: "drip_surge";
  roundTiles: number;             // classic mode (40–200, default 100)
  dripPerSec: number;
  surgeAtSec: number;
  surgeAmount: number;
  // Yoink mode settings
  rounds: number;                 // default 3
  roundDurationSec: number;       // default 60
  intermissionSec: number;        // default 10
};

type Player = {
  id: string;
  name: string;
  liveScore: number;
  words: { word: string; base: number }[];
  hand: Record<string, number>; // classic: unused; yoink: personal bank (max 7)
  bank: string[];               // yoink: ordered bank array (max 7)
  lastYoinkTime: number;        // yoink cooldown tracking
};

type Submission = {
  ts: number;
  socketId: string;
  playerId: string;
  word: string;
};

type RoomState = {
  id: string;
  settings: Settings;
  players: Map<string, Player>;

  // Classic mode tiles
  pool: Record<string, number>;
  bag: string[];
  revealed: number;

  // Yoink mode shared pool (4×4 grid, 16 slots)
  yoinkPool: (string | null)[];
  spawnTimer?: NodeJS.Timeout;

  // Round lifecycle
  started: boolean;
  phase: Phase;
  currentRound: number;          // 1-indexed
  totalRounds: number;
  cumulativeScores: Map<string, number>;
  endAt?: number;
  tick?: NodeJS.Timeout;

  // Classic fairness
  shadowWindowMs: number;
  pending: Map<number, Submission[]>;
  wordCounts: Map<string, number>;
};

// ===== Scoring / Bag (Classic) =====
const POINTS: Record<string, number> = {
  "_": 0,
  E: 1, A: 1, O: 1, T: 1, I: 1, N: 1, R: 1, S: 1, L: 1, U: 1,
  D: 2, G: 2,
  C: 3, M: 3, B: 3, P: 3,
  H: 4, F: 4, W: 4, Y: 4, V: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10
};

const COUNTS: Record<string, number> = {
  "_": 4,
  E: 24, A: 16, O: 15, T: 15, I: 13, N: 13, R: 13, S: 10, L: 7, U: 7,
  D: 8, G: 5,
  C: 6, M: 6, B: 4, P: 4,
  H: 5, F: 4, W: 4, Y: 4, V: 3,
  K: 2, J: 2, X: 2, Q: 2, Z: 2
};

// ===== Dictionary =====
let DICT = new Set<string>(["TEAM", "BOX", "STONE", "RUSH"]);

async function initDictionary() {
  try {
    const env = (process.env.WORDLIST_URLS || "").trim();
    const urls = env
      ? env.split(",").map(s => s.trim()).filter(Boolean)
      : ["https://raw.githubusercontent.com/wordnik/wordlist/master/english/english.txt"];
    DICT = await loadWordlists(urls);
    console.log(`[dict] loaded ${DICT.size.toLocaleString()} words from ${urls.length} url(s).`);
  } catch (e) {
    console.error("[dict] failed to load; using fallback:", e);
  }
}

// ===== Server boot =====
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get("/", (_req, res) => res.send("YOINK word server running"));

const rooms = new Map<string, RoomState>();

// ===== Utils =====
function scoreWord(word: string): number {
  const base = [...word].reduce((s, ch) => s + (POINTS[ch] ?? 0), 0);
  const bonus = 1 + 0.05 * word.length;
  return Math.round(base * bonus);
}

function makeBag(): string[] {
  const bag: string[] = [];
  Object.entries(COUNTS).forEach(([ch, n]) => {
    for (let i = 0; i < n; i++) bag.push(ch);
  });
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function canConsumeWord(word: string, pool: Record<string, number>): boolean {
  const need: Record<string, number> = {};
  for (const ch of word) need[ch] = (need[ch] ?? 0) + 1;
  const have: Record<string, number> = { ...pool };
  for (const ch of Object.keys(need)) {
    const take = Math.min(need[ch], have[ch] ?? 0);
    need[ch] -= take;
    have[ch] = (have[ch] ?? 0) - take;
  }
  const remain = Object.values(need).reduce((s, c) => s + c, 0);
  return (have["_"] ?? 0) >= remain;
}

function consumeWord(word: string, pool: Record<string, number>) {
  for (const ch of word) {
    if ((pool[ch] ?? 0) > 0) pool[ch]!--;
    else if ((pool["_"] ?? 0) > 0) pool["_"]!--;
  }
}

function nowWindowKey(nowMs: number, sizeMs: number): number {
  return Math.floor(nowMs / sizeMs);
}

// ===== Yoink pool helpers =====
function fillYoinkPool(pool: (string | null)[]): void {
  for (let i = 0; i < 16; i++) {
    if (pool[i] === null) pool[i] = weightedRandomLetter();
  }
}

function countPoolTiles(pool: (string | null)[]): number {
  return pool.filter(t => t !== null).length;
}

function startSpawnTimer(r: RoomState) {
  if (r.spawnTimer) clearTimeout(r.spawnTimer);

  function scheduleNext() {
    const count = countPoolTiles(r.yoinkPool);
    if (count >= 16 || r.phase !== "playing") {
      // Check again later if playing
      if (r.phase === "playing") {
        r.spawnTimer = setTimeout(scheduleNext, 500);
      }
      return;
    }
    const interval = spawnIntervalMs(count);
    r.spawnTimer = setTimeout(() => {
      if (r.phase !== "playing") return;
      // Find a random empty slot
      const empties = r.yoinkPool.map((t, i) => t === null ? i : -1).filter(i => i >= 0);
      if (empties.length > 0) {
        const idx = empties[Math.floor(Math.random() * empties.length)];
        r.yoinkPool[idx] = weightedRandomLetter();
        emitStateToAll(r);
      }
      scheduleNext();
    }, interval);
  }

  scheduleNext();
}

// ===== State emission =====
function publicState(r: RoomState, forSocketId?: string) {
  if (r.settings.gameMode === "yoink") {
    const player = forSocketId ? r.players.get(forSocketId) : undefined;
    const roundIdx = Math.max(0, r.currentRound - 1);
    const multiplier = ROUND_MULTIPLIERS[roundIdx] ?? 1.0;

    return {
      id: r.id,
      settings: r.settings,
      gameMode: "yoink" as const,
      players: [...r.players.values()].map(p => ({
        id: p.id,
        name: p.name,
        // Don't show scores during playing phase
      })),
      pool: r.yoinkPool,
      bank: player?.bank ?? [],
      myScore: player?.liveScore ?? 0,
      endsInMs: Math.max(0, (r.endAt ?? Date.now()) - Date.now()),
      phase: r.phase,
      currentRound: r.currentRound,
      totalRounds: r.totalRounds,
      roundMultiplier: multiplier,
      scoresHidden: r.phase === "playing",
    };
  }

  // Classic mode
  return {
    id: r.id,
    settings: r.settings,
    gameMode: "classic" as const,
    players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, score: p.liveScore })),
    pool: r.pool,
    endsInMs: Math.max(0, (r.endAt ?? Date.now()) - Date.now()),
    revealed: r.revealed,
    roundTiles: r.settings.roundTiles,
    bagRemaining: r.bag.length - r.revealed,
    hand: forSocketId ? (r.players.get(forSocketId)?.hand ?? {}) : undefined,
  };
}

function emitStateToAll(r: RoomState) {
  for (const [sid] of r.players) {
    const s = io.sockets.sockets.get(sid);
    if (s) s.emit("lobby:state", publicState(r, sid));
  }
}

// ===== Rate limiter =====
const buckets = new Map<string, { tokens: number; last: number }>();
function allowSubmit(socketId: string): boolean {
  const cap = 10, rate = 5;
  const now = Date.now();
  const t = buckets.get(socketId) ?? { tokens: cap, last: now };
  const elapsed = (now - t.last) / 1000;
  t.tokens = Math.min(cap, t.tokens + elapsed * rate);
  t.last = now;
  if (t.tokens >= 1) {
    t.tokens -= 1;
    buckets.set(socketId, t);
    return true;
  }
  buckets.set(socketId, t);
  return false;
}

// ===== Room lifecycle =====
function ensureRoom(roomId: string): RoomState {
  let r = rooms.get(roomId);
  if (r) return r;

  const settings: Settings = {
    gameMode: "yoink",
    durationSec: 120,
    minLen: 3,
    uniqueWords: "allow_with_decay",
    decayModel: "linear",
    revealModel: "drip_surge",
    roundTiles: 100,
    dripPerSec: 2,
    surgeAtSec: 60,
    surgeAmount: 10,
    rounds: 3,
    roundDurationSec: 60,
    intermissionSec: 10,
  };

  r = {
    id: roomId,
    settings,
    players: new Map(),
    pool: {},
    bag: [],
    revealed: 0,
    yoinkPool: new Array(16).fill(null),
    started: false,
    phase: "lobby",
    currentRound: 0,
    totalRounds: settings.rounds,
    cumulativeScores: new Map(),
    shadowWindowMs: 150,
    pending: new Map(),
    wordCounts: new Map(),
  };
  rooms.set(roomId, r);
  return r;
}

// ===== Yoink mode round flow =====
function startYoinkGame(r: RoomState) {
  r.totalRounds = r.settings.rounds;
  r.currentRound = 0;
  r.cumulativeScores.clear();
  for (const p of r.players.values()) {
    r.cumulativeScores.set(p.id, 0);
  }
  startNextYoinkRound(r);
}

function startNextYoinkRound(r: RoomState) {
  r.currentRound++;
  r.phase = "playing";
  r.started = true;

  // Reset pool and banks
  r.yoinkPool = new Array(16).fill(null);
  fillYoinkPool(r.yoinkPool);

  for (const p of r.players.values()) {
    p.liveScore = 0;
    p.words = [];
    p.hand = {};
    p.bank = [];
    p.lastYoinkTime = 0;
  }

  r.wordCounts.clear();
  r.endAt = Date.now() + r.settings.roundDurationSec * 1000;

  // Start spawn timer
  startSpawnTimer(r);

  // Tick timer
  r.tick && clearInterval(r.tick);
  r.tick = setInterval(() => {
    const now = Date.now();
    if (now >= (r.endAt ?? now)) {
      clearInterval(r.tick!);
      r.tick = undefined;
      if (r.spawnTimer) { clearTimeout(r.spawnTimer); r.spawnTimer = undefined; }
      endYoinkRound(r);
      return;
    }
    emitStateToAll(r);
  }, 1000);

  emitStateToAll(r);
}

function endYoinkRound(r: RoomState) {
  // Calculate round scores and add to cumulative
  const roundResults: { id: string; name: string; roundScore: number; cumulativeScore: number }[] = [];

  for (const p of r.players.values()) {
    const cumBefore = r.cumulativeScores.get(p.id) ?? 0;
    const cumAfter = cumBefore + p.liveScore;
    r.cumulativeScores.set(p.id, cumAfter);
    roundResults.push({
      id: p.id,
      name: p.name,
      roundScore: p.liveScore,
      cumulativeScore: cumAfter,
    });
  }

  roundResults.sort((a, b) => b.cumulativeScore - a.cumulativeScore);

  io.to(r.id).emit("round:ended", {
    round: r.currentRound,
    totalRounds: r.totalRounds,
    leaderboard: roundResults,
  });

  if (r.currentRound >= r.totalRounds) {
    // Game over
    r.phase = "finished";
    r.started = false;
    io.to(r.id).emit("game:ended", {
      leaderboard: roundResults,
    });
    emitStateToAll(r);
  } else {
    // Intermission
    r.phase = "intermission";
    r.endAt = Date.now() + r.settings.intermissionSec * 1000;
    emitStateToAll(r);

    setTimeout(() => {
      if (r.phase === "intermission") {
        startNextYoinkRound(r);
      }
    }, r.settings.intermissionSec * 1000);
  }
}

// ===== Classic mode =====
function startClassicRound(r: RoomState) {
  r.pool = {};
  r.bag = makeBag();
  r.revealed = 0;
  r.wordCounts.clear();
  r.pending.clear();
  for (const p of r.players.values()) {
    p.liveScore = 0;
    p.words = [];
    p.hand = {};
    p.bank = [];
  }
  r.started = true;
  r.phase = "playing";
  r.endAt = Date.now() + r.settings.durationSec * 1000;

  const open = Math.min(20, r.settings.roundTiles);
  const opening = r.bag.slice(0, open);
  for (const ch of opening) r.pool[ch] = (r.pool[ch] ?? 0) + 1;
  r.revealed = open;

  r.tick && clearInterval(r.tick);
  r.tick = setInterval(() => {
    const now = Date.now();
    if (now >= (r.endAt ?? now)) {
      clearInterval(r.tick!);
      r.tick = undefined;
      r.started = false;
      finalizeRoundWithDecay(r);
      return;
    }

    if (r.revealed < r.settings.roundTiles) {
      const take = Math.min(r.settings.dripPerSec, r.settings.roundTiles - r.revealed);
      const more = r.bag.slice(r.revealed, r.revealed + take);
      for (const ch of more) r.pool[ch] = (r.pool[ch] ?? 0) + 1;
      r.revealed += take;
    }

    const elapsed = Math.round(((r.settings.durationSec * 1000) - ((r.endAt ?? now) - now)) / 1000);
    if (elapsed >= r.settings.surgeAtSec && r.settings.surgeAmount > 0) {
      const take = Math.min(r.settings.surgeAmount, r.settings.roundTiles - r.revealed);
      if (take > 0) {
        const more = r.bag.slice(r.revealed, r.revealed + take);
        for (const ch of more) r.pool[ch] = (r.pool[ch] ?? 0) + 1;
        r.revealed += take;
      }
      r.settings.surgeAmount = 0;
    }

    emitStateToAll(r);
    const key = nowWindowKey(now - r.shadowWindowMs, r.shadowWindowMs);
    processShadowWindow(r, key);
  }, 1000);
}

function processShadowWindow(r: RoomState, windowKey: number) {
  const subs = r.pending.get(windowKey);
  if (!subs || subs.length === 0) return;

  const snapshot: Record<string, number> = { ...r.pool };
  subs.sort((a, b) => a.ts - b.ts);

  const accepted: Submission[] = [];
  for (const s of subs) {
    const word = s.word;
    if (!/^[A-Z]+$/.test(word)) continue;
    if (word.length < r.settings.minLen) continue;
    if (!DICT.has(word)) continue;
    if (r.settings.uniqueWords === "disallow") {
      const p = r.players.get(s.playerId);
      if (p && p.words.find(w => w.word === word)) continue;
    }
    if (canConsumeWord(word, snapshot)) {
      consumeWord(word, snapshot);
      accepted.push(s);
    }
  }

  for (const s of accepted) {
    const p = r.players.get(s.playerId);
    if (!p) continue;
    const pts = scoreWord(s.word);
    consumeWord(s.word, r.pool);
    p.words.push({ word: s.word, base: pts });
    p.liveScore += pts;
    r.wordCounts.set(s.word, (r.wordCounts.get(s.word) ?? 0) + 1);
    io.to(r.id).emit("word:accepted", {
      playerId: s.playerId,
      name: p.name,
      letters: s.word.length,
      points: pts,
      feed: `${p.name} played ${s.word.length} letters for ${pts} points.`
    });
  }

  r.pending.delete(windowKey);
}

function finalizeRoundWithDecay(r: RoomState) {
  const model = r.settings.decayModel;
  function decay(base: number, c: number): number {
    if (r.settings.uniqueWords === "allow_no_penalty") return base;
    if (r.settings.uniqueWords === "disallow") return base;
    if (c <= 1) return base;
    let factor = 1;
    if (model === "linear") factor = 1 / c;
    else if (model === "soft") factor = 1 / (1 + 0.6 * (c - 1));
    else if (model === "steep") factor = 1 / Math.pow(c, 1.3);
    return Math.round(base * factor);
  }

  const final = [...r.players.values()]
    .map(p => {
      let finalScore = 0;
      for (const w of p.words) {
        const c = r.wordCounts.get(w.word) ?? 1;
        finalScore += decay(w.base, c);
      }
      return { id: p.id, name: p.name, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  io.to(r.id).emit("round:ended", { leaderboard: final });
  emitStateToAll(r);
}

// ===== Check if bank letter array can form word =====
function canConsumeFromBank(word: string, bank: string[]): boolean {
  const available = [...bank];
  for (const ch of word.toUpperCase()) {
    const idx = available.indexOf(ch);
    if (idx === -1) return false;
    available.splice(idx, 1);
  }
  return true;
}

function consumeFromBank(word: string, bank: string[]): string[] {
  const remaining = [...bank];
  for (const ch of word.toUpperCase()) {
    const idx = remaining.indexOf(ch);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining;
}

// ===== Socket wiring =====
io.on("connection", (socket: Socket) => {
  let roomId: string | null = null;
  let playerId: string | null = null;

  socket.on("lobby:join", ({ room, name }: { room: string; name: string }) => {
    roomId = room;
    playerId = socket.id;

    const r = ensureRoom(room);
    if (!r.players.has(socket.id)) {
      r.players.set(socket.id, {
        id: socket.id,
        name: name?.slice(0, 16) || "Player",
        liveScore: 0,
        words: [],
        hand: {},
        bank: [],
        lastYoinkTime: 0,
      });
      r.cumulativeScores.set(socket.id, 0);
    }
    socket.join(room);
    emitStateToAll(r);
  });

  // ===== tile:yoink — grab a tile from shared pool =====
  socket.on("tile:yoink", (payload: { index: number }) => {
    if (!roomId || !playerId) return;
    const r = rooms.get(roomId);
    if (!r || r.phase !== "playing" || r.settings.gameMode !== "yoink") return;

    const player = r.players.get(playerId);
    if (!player) return;

    const { index } = payload;
    if (typeof index !== "number" || index < 0 || index > 15) return;

    // Check tile exists
    const tile = r.yoinkPool[index];
    if (tile === null) return;

    // Check bank has room (< 7)
    if (player.bank.length >= 7) {
      socket.emit("yoink:rejected", { reason: "bank full" });
      return;
    }

    // 500ms cooldown
    const now = Date.now();
    if (now - player.lastYoinkTime < 500) {
      socket.emit("yoink:rejected", { reason: "too fast" });
      return;
    }

    // Success — first to server wins
    player.lastYoinkTime = now;
    r.yoinkPool[index] = null;
    player.bank.push(tile);

    // Restart spawn timer since a tile was taken
    startSpawnTimer(r);

    emitStateToAll(r);

    // Notify all of the yoink event
    io.to(r.id).emit("tile:yoinked", {
      playerId: player.id,
      playerName: player.name,
      index,
      letter: tile,
    });
  });

  // ===== word:submit =====
  socket.on("word:submit", (payload: { word: string }) => {
    if (!roomId || !playerId) return;
    const r = rooms.get(roomId);
    if (!r || !r.started) return;
    if (!allowSubmit(socket.id)) return;

    const word = (payload.word || "").toUpperCase();

    if (r.settings.gameMode === "yoink") {
      const player = r.players.get(playerId);
      if (!player) return;
      if (!/^[A-Z]+$/.test(word)) return;

      if (word.length < r.settings.minLen) {
        socket.emit("word:rejected", { word, reason: "too short" });
        return;
      }
      if (word.length > 7) {
        socket.emit("word:rejected", { word, reason: "too long (max 7)" });
        return;
      }
      if (!DICT.has(word)) {
        socket.emit("word:rejected", { word, reason: "not in dictionary" });
        return;
      }
      if (!canConsumeFromBank(word, player.bank)) {
        socket.emit("word:rejected", { word, reason: "not enough tiles in bank" });
        return;
      }

      // Consume from bank
      player.bank = consumeFromBank(word, player.bank);

      // Score with round multiplier
      const roundIdx = Math.max(0, r.currentRound - 1);
      const multiplier = ROUND_MULTIPLIERS[roundIdx] ?? 1.0;
      const pts = scoreYoinkWord(word, multiplier);
      player.words.push({ word, base: pts });
      player.liveScore += pts;

      socket.emit("word:accepted", {
        playerId,
        name: player.name,
        word,
        letters: word.length,
        points: pts,
        feed: `${player.name} played ${word} for ${pts} pts`
      });

      emitStateToAll(r);
      return;
    }

    // Classic mode: queue into shadow window
    const ts = Date.now();
    const key = nowWindowKey(ts, r.shadowWindowMs);
    if (!r.pending.has(key)) r.pending.set(key, []);
    r.pending.get(key)!.push({ ts, socketId: socket.id, playerId, word });
  });

  // --- Settings & Start ---
  socket.on("settings:update", (partial: Partial<Settings>) => {
    if (!roomId) return;
    const r = rooms.get(roomId);
    if (!r) return;

    if (partial.gameMode === "classic" || partial.gameMode === "yoink") {
      r.settings.gameMode = partial.gameMode;
    }
    if (typeof partial.durationSec === "number") {
      r.settings.durationSec = Math.max(30, Math.min(600, Math.round(partial.durationSec)));
    }
    if (typeof partial.minLen === "number") {
      r.settings.minLen = Math.max(2, Math.min(6, Math.round(partial.minLen)));
    }
    if (partial.uniqueWords) r.settings.uniqueWords = partial.uniqueWords;
    if (partial.decayModel) r.settings.decayModel = partial.decayModel;
    if (typeof partial.roundTiles === "number") {
      r.settings.roundTiles = Math.max(40, Math.min(200, Math.round(partial.roundTiles)));
    }
    if (typeof partial.rounds === "number") {
      r.settings.rounds = Math.max(1, Math.min(5, Math.round(partial.rounds)));
    }
    if (typeof partial.roundDurationSec === "number") {
      r.settings.roundDurationSec = Math.max(15, Math.min(300, Math.round(partial.roundDurationSec)));
    }
    if (typeof partial.intermissionSec === "number") {
      r.settings.intermissionSec = Math.max(3, Math.min(30, Math.round(partial.intermissionSec)));
    }

    r.settings.surgeAmount = 10;
    emitStateToAll(r);
  });

  socket.on("game:start", () => {
    if (!roomId) return;
    const r = rooms.get(roomId);
    if (!r) return;

    if (r.settings.gameMode === "yoink") {
      startYoinkGame(r);
    } else {
      startClassicRound(r);
    }
    emitStateToAll(r);
  });

  socket.on("disconnect", () => {
    if (!roomId || !playerId) return;
    const r = rooms.get(roomId);
    if (!r) return;
    r.players.delete(playerId);
    emitStateToAll(r);
  });
});

// ===== Listen =====
const PORT = process.env.PORT || 5177;
initDictionary().finally(() => {
  server.listen(PORT, () => {
    console.log(`YOINK server listening on :${PORT}`);
  });
});
