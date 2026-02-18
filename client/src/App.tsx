import React, { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { POINTS, scoreWord, YOINK_POINTS, yoinkPointTier, scoreYoinkWord, ROUND_MULTIPLIERS } from "./lib/scoring";

// ===== Types =====
type YoinkState = {
  id: string;
  settings: {
    gameMode: "yoink";
    rounds: number;
    roundDurationSec: number;
    intermissionSec: number;
    minLen: number;
    [k: string]: unknown;
  };
  gameMode: "yoink";
  players: { id: string; name: string }[];
  pool: (string | null)[];
  bank: string[];
  myScore: number;
  endsInMs: number;
  phase: "lobby" | "playing" | "intermission" | "finished";
  currentRound: number;
  totalRounds: number;
  roundMultiplier: number;
  scoresHidden: boolean;
};

type ClassicState = {
  id: string;
  settings: {
    gameMode: "classic";
    durationSec: number;
    minLen: number;
    uniqueWords: string;
    decayModel: string;
    roundTiles: number;
    [k: string]: unknown;
  };
  gameMode: "classic";
  players: { id: string; name: string; score: number }[];
  pool: Record<string, number>;
  endsInMs: number;
  revealed: number;
  roundTiles: number;
  bagRemaining: number;
  hand?: Record<string, number>;
};

type ServerState = YoinkState | ClassicState;

type RoundEndedEvt = {
  round: number;
  totalRounds: number;
  leaderboard: { id: string; name: string; roundScore: number; cumulativeScore: number }[];
};

type GameEndedEvt = {
  leaderboard: { id: string; name: string; roundScore: number; cumulativeScore: number }[];
};

type AcceptedEvt = {
  playerId: string;
  name: string;
  word?: string;
  letters: number;
  points: number;
  feed: string;
};

const NUMBER = new Intl.NumberFormat();

// Tile background color by point tier
function tileBg(letter: string | null): string {
  if (!letter) return "bg-neutral-800";
  const tier = yoinkPointTier(letter);
  if (tier === 30) return "bg-yellow-500/30 ring-1 ring-yellow-400";
  if (tier === 20) return "bg-blue-500/20 ring-1 ring-blue-400/50";
  return "bg-neutral-900";
}

export default function App() {
  // Connection
  const [room, setRoom] = useState("test");
  const [name, setName] = useState("");
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const sockRef = useRef<Socket | null>(null);

  // State
  const [state, setState] = useState<ServerState | null>(null);
  const [feed, setFeed] = useState<string[]>([]);
  const [rejection, setRejection] = useState<string | null>(null);

  // Yoink word builder
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]); // indices into bank
  const [lastPointsEarned, setLastPointsEarned] = useState<number | null>(null);
  const [yoinkedIndex, setYoinkedIndex] = useState<number | null>(null);
  const [shakeSubmit, setShakeSubmit] = useState(false);

  // Round flow
  const [roundLeaderboard, setRoundLeaderboard] = useState<RoundEndedEvt | null>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<GameEndedEvt | null>(null);

  // Connect
  function connect() {
    const url = import.meta.env.VITE_SOCKET_URL || "";
    if (!url) return;
    const s = io(url, { transports: ["websocket"], timeout: 3000 });
    sockRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      s.emit("lobby:join", { room: room.trim() || "test", name: name.trim() || "Player" });
      setJoined(true);
    });

    s.on("lobby:state", (st: ServerState) => {
      setState(st);
      // Clear round leaderboard when playing starts
      if ("phase" in st && st.phase === "playing") setRoundLeaderboard(null);
    });

    s.on("word:accepted", (evt: AcceptedEvt) => {
      setFeed(prev => [evt.feed, ...prev].slice(0, 10));
      if (evt.playerId === s.id) {
        setLastPointsEarned(evt.points);
        setTimeout(() => setLastPointsEarned(null), 2000);
      }
    });

    s.on("word:rejected", (evt: { word: string; reason: string }) => {
      setRejection(`"${evt.word}" — ${evt.reason}`);
      setShakeSubmit(true);
      setTimeout(() => { setRejection(null); setShakeSubmit(false); }, 2000);
    });

    s.on("yoink:rejected", (evt: { reason: string }) => {
      // silent for now
    });

    s.on("tile:yoinked", (evt: { playerId: string; index: number }) => {
      if (evt.playerId === s.id) {
        setYoinkedIndex(evt.index);
        setTimeout(() => setYoinkedIndex(null), 400);
      }
    });

    s.on("round:ended", (evt: RoundEndedEvt) => {
      setRoundLeaderboard(evt);
      setSelectedIndices([]);
    });

    s.on("game:ended", (evt: GameEndedEvt) => {
      setFinalLeaderboard(evt);
      setSelectedIndices([]);
    });

    s.on("disconnect", () => {
      setConnected(false);
      setState(null);
      setJoined(false);
    });
  }

  // Yoink a tile from pool
  function yoinkTile(index: number) {
    sockRef.current?.emit("tile:yoink", { index });
  }

  // Toggle bank letter selection
  function toggleBankLetter(bankIndex: number) {
    setSelectedIndices(prev => {
      if (prev.includes(bankIndex)) return prev.filter(i => i !== bankIndex);
      return [...prev, bankIndex];
    });
  }

  // Build word from selected
  const bank = (state as YoinkState)?.bank ?? [];
  const assembledWord = selectedIndices.map(i => bank[i]).join("");

  // Submit word
  function submitWord() {
    if (!assembledWord || assembledWord.length < (state?.settings?.minLen ?? 3)) return;
    sockRef.current?.emit("word:submit", { word: assembledWord });
    setSelectedIndices([]);
  }

  // Derived
  const isYoink = state?.gameMode === "yoink";
  const seconds = Math.ceil((state?.endsInMs ?? 0) / 1000);
  const phase = (state as YoinkState)?.phase ?? "lobby";
  const currentRound = (state as YoinkState)?.currentRound ?? 0;
  const totalRounds = (state as YoinkState)?.totalRounds ?? 3;
  const roundMultiplier = (state as YoinkState)?.roundMultiplier ?? 1.0;
  const myScore = (state as YoinkState)?.myScore ?? 0;
  const pool = (state as YoinkState)?.pool ?? [];

  // Round bonus text
  const bonusText = roundMultiplier > 1 ? `${Math.round((roundMultiplier - 1) * 100)}% bonus!` : "";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      {/* Header */}
      <header className="p-4 border-b border-neutral-800">
        <h1 className="text-3xl font-black tracking-tight">🫳 YOINK!</h1>

        {/* Join controls */}
        {!joined && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
              placeholder="Room code"
              value={room}
              onChange={e => setRoom(e.target.value)}
            />
            <input
              className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button className="rounded-xl bg-indigo-500 px-3 py-2 font-semibold" onClick={connect}>
              Join
            </button>
          </div>
        )}

        {/* Settings (when in lobby, connected) */}
        {joined && isYoink && phase === "lobby" && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-neutral-400 text-sm">Waiting in lobby... Host can start the game.</p>
            <div className="flex gap-2 items-end flex-wrap">
              <label className="text-xs text-neutral-400">
                Mode
                <select
                  className="w-full mt-1 rounded-lg bg-neutral-800 px-3 py-2 outline-none"
                  defaultValue="yoink"
                  onChange={e => sockRef.current?.emit("settings:update", { gameMode: e.target.value })}
                >
                  <option value="yoink">Yoink</option>
                  <option value="classic">Classic</option>
                </select>
              </label>
              <button
                className="rounded-xl bg-indigo-500 px-4 py-2 font-semibold"
                onClick={() => sockRef.current?.emit("game:start")}
              >
                Start Game
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ===== YOINK MODE GAMEPLAY ===== */}
      {joined && isYoink && phase === "playing" && (
        <>
          {/* Top bar */}
          <div className="px-4 py-2 flex items-center justify-between border-b border-neutral-800">
            <div className="text-sm font-semibold text-indigo-400">
              Round {currentRound}/{totalRounds}
              {bonusText && <span className="ml-2 text-yellow-400">⚡ {bonusText}</span>}
            </div>
            <div className="text-2xl font-mono font-bold tabular-nums">{seconds}s</div>
            <div className="text-sm">
              Your score: <span className="font-bold text-emerald-400">{NUMBER.format(myScore)}</span>
            </div>
          </div>

          {/* Points earned flash */}
          {lastPointsEarned !== null && (
            <div className="text-center py-1 text-emerald-400 font-bold text-lg animate-bounce">
              +{lastPointsEarned} pts!
            </div>
          )}

          {/* 4×4 Pool Grid */}
          <section className="px-4 py-3">
            <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
              {pool.map((tile, i) => (
                <button
                  key={i}
                  className={`relative aspect-square rounded-xl flex items-center justify-center text-2xl font-bold transition-all
                    ${tile ? `${tileBg(tile)} active:scale-90 cursor-pointer hover:brightness-125` : "bg-neutral-800/40 cursor-default"}
                    ${yoinkedIndex === i ? "scale-75 opacity-50" : ""}`}
                  onClick={() => tile && yoinkTile(i)}
                  disabled={!tile}
                >
                  {tile ?? ""}
                  {tile && (
                    <span className="absolute bottom-0.5 right-1 text-[0.55rem] font-semibold text-neutral-400">
                      {YOINK_POINTS[tile] ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Word builder preview */}
          <section className="px-4">
            <div className="text-center min-h-[2.5rem] flex items-center justify-center gap-1">
              {assembledWord ? (
                <span className="text-2xl font-bold tracking-widest text-white">
                  {assembledWord}
                </span>
              ) : (
                <span className="text-neutral-500 text-sm">Tap bank letters to build a word</span>
              )}
            </div>
          </section>

          {/* Personal Bank (7 slots) */}
          <section className="px-4 py-2">
            <div className="flex justify-center gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const letter = bank[i] ?? null;
                const isSelected = selectedIndices.includes(i);
                return (
                  <button
                    key={i}
                    className={`w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold transition-all
                      ${!letter ? "bg-neutral-800/30 border border-dashed border-neutral-700" : ""}
                      ${letter && !isSelected ? `${tileBg(letter)} cursor-pointer hover:brightness-125` : ""}
                      ${letter && isSelected ? "bg-indigo-500 ring-2 ring-indigo-300 scale-90" : ""}`}
                    onClick={() => letter && toggleBankLetter(i)}
                    disabled={!letter}
                  >
                    {letter && (
                      <>
                        {letter}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Action buttons */}
          <section className="px-4 py-2 flex justify-center gap-3">
            <button
              className="rounded-xl bg-neutral-700 px-4 py-2 text-sm font-semibold"
              onClick={() => setSelectedIndices([])}
              disabled={selectedIndices.length === 0}
            >
              Clear
            </button>
            <button
              className={`rounded-xl px-6 py-2 text-sm font-bold transition-all
                ${assembledWord.length >= (state?.settings?.minLen ?? 3)
                  ? "bg-emerald-500 hover:bg-emerald-400"
                  : "bg-neutral-700 text-neutral-400"}
                ${shakeSubmit ? "animate-pulse bg-red-500" : ""}`}
              onClick={submitWord}
              disabled={assembledWord.length < (state?.settings?.minLen ?? 3)}
            >
              Submit
            </button>
          </section>

          {/* Feed */}
          <section className="px-4 py-2 mt-auto">
            <ul className="space-y-0.5">
              {feed.slice(0, 5).map((f, i) => (
                <li key={i} className="text-xs text-neutral-500">{f}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* ===== INTERMISSION (between rounds) ===== */}
      {joined && isYoink && phase === "intermission" && roundLeaderboard && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <h2 className="text-xl font-bold mb-1">Round {roundLeaderboard.round} Complete!</h2>
          <p className="text-neutral-400 text-sm mb-4">Next round starting in {seconds}s...</p>
          <div className="w-full max-w-sm">
            {roundLeaderboard.leaderboard.map((p, idx) => {
              const isLeader = idx === 0;
              return (
                <div key={p.id} className="flex justify-between py-2 border-b border-neutral-800">
                  <span>
                    {isLeader && "👑 "}{idx + 1}. {p.name}
                  </span>
                  <span className="font-bold">
                    {NUMBER.format(p.cumulativeScore)}
                    <span className="text-neutral-500 text-xs ml-1">(+{p.roundScore})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== FINISHED (game over) ===== */}
      {joined && isYoink && (phase === "finished" || finalLeaderboard) && finalLeaderboard && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <h2 className="text-2xl font-black mb-4">🏆 Game Over!</h2>
          <div className="w-full max-w-sm">
            {finalLeaderboard.leaderboard.map((p, idx) => {
              const isLeader = idx === 0;
              return (
                <div key={p.id} className={`flex justify-between py-3 border-b border-neutral-800 ${isLeader ? "text-yellow-400" : ""}`}>
                  <span className="font-semibold">
                    {isLeader && "👑 "}{idx + 1}. {p.name}
                  </span>
                  <span className="font-bold text-lg">{NUMBER.format(p.cumulativeScore)}</span>
                </div>
              );
            })}
          </div>
          <button
            className="mt-6 rounded-xl bg-indigo-500 px-6 py-3 font-semibold"
            onClick={() => {
              setFinalLeaderboard(null);
              setRoundLeaderboard(null);
              setFeed([]);
              sockRef.current?.emit("game:start");
            }}
          >
            Play Again
          </button>
        </div>
      )}

      {/* ===== CLASSIC MODE (unchanged) ===== */}
      {joined && !isYoink && state && (
        <ClassicModeUI state={state as ClassicState} sockRef={sockRef} name={name} />
      )}

      {/* Rejection toast */}
      {rejection && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold z-50 animate-pulse">
          {rejection}
        </div>
      )}
    </div>
  );
}

// ===== Classic Mode UI (preserved from original) =====
function ClassicModeUI({ state, sockRef, name }: { state: ClassicState; sockRef: React.MutableRefObject<Socket | null>; name: string }) {
  const [input, setInput] = useState("");
  const [feed, setFeed] = useState<string[]>([]);
  const seconds = Math.ceil((state?.endsInMs ?? 0) / 1000);

  const tiles = React.useMemo(() => {
    const arr: string[] = [];
    for (const [ch, count] of Object.entries(state.pool)) {
      for (let i = 0; i < (count ?? 0); i++) arr.push(ch);
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [state.pool]);

  function submit() {
    const w = input.trim().toUpperCase();
    if (!w || !/^[A-Z]+$/.test(w)) return;
    sockRef.current?.emit("word:submit", { word: w });
    setInput("");
  }

  return (
    <>
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-lg font-mono">{seconds}s</div>
        <div className="text-sm text-neutral-400">Tiles: {state.revealed}/{state.roundTiles}</div>
        <div className="text-sm text-neutral-400">Players: {state.players.length}</div>
      </div>

      <section className="px-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))" }}>
          {tiles.map((ch, i) => (
            <div key={`${ch}-${i}`} className="relative aspect-square rounded-lg bg-neutral-900 flex items-center justify-center text-2xl font-bold">
              {ch === "_" ? "␣" : ch}
              <span className="absolute bottom-1 right-1 text-[0.6rem] font-semibold text-neutral-400">
                {POINTS[ch] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 mt-auto pb-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-2xl bg-neutral-900 px-4 py-3 text-lg outline-none"
            placeholder="type a word…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
          <button className="rounded-2xl bg-indigo-500 px-4 py-3 text-lg font-semibold" onClick={submit}>
            Play
          </button>
        </div>
      </section>

      <section className="px-4 pb-4">
        <div className="text-sm text-neutral-400 mb-1">Scores</div>
        <ul className="space-y-1">
          {state.players.slice().sort((a, b) => b.score - a.score).map(p => (
            <li key={p.id} className="flex justify-between">
              <span>{p.name}</span>
              <span className="font-semibold">{NUMBER.format(p.score)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
