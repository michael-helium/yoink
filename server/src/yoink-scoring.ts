// server/src/yoink-scoring.ts — Yoink scoring helpers

// ===== Legacy scoring (kept for backward compatibility) =====

/**
 * Score a player's grid in Yoink mode (LEGACY bananagrams-style).
 */
export function scoreYoinkGrid(
  words: string[],
  unusedTileCount: number
): number {
  const wordPoints = words.reduce((sum, w) => sum + w.length * w.length, 0);
  const penalty = unusedTileCount * 3;
  return Math.max(0, wordPoints - penalty);
}

/**
 * Count total tiles in a hand map.
 */
export function countTiles(hand: Record<string, number>): number {
  return Object.values(hand).reduce((s, n) => s + n, 0);
}

/** Bonus awarded when a player successfully calls YOINK! (legacy) */
export const YOINK_BONUS = 50;

/** Penalty when a player calls YOINK! but still has tiles (legacy) */
export const YOINK_PENALTY = 10;

// ===== New Yoink mode scoring (shared 4×4 grid) =====

/** Letter point values for the new yoink mode */
export const YOINK_POINTS: Record<string, number> = {
  A: 10, B: 20, C: 20, D: 10, E: 10, F: 20, G: 10, H: 20, I: 10,
  J: 30, K: 20, L: 10, M: 20, N: 10, O: 10, P: 20, Q: 30, R: 10,
  S: 10, T: 10, U: 10, V: 20, W: 20, X: 30, Y: 20, Z: 30,
};

/** Letter weights for weighted random spawning */
export const LETTER_WEIGHTS: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

/** Round multipliers */
export const ROUND_MULTIPLIERS = [1.0, 1.2, 1.5];

/**
 * Score a single word in yoink mode.
 * Formula: Sum(letter_values) × (1 + 0.20 × word_length) × round_multiplier
 */
export function scoreYoinkWord(word: string, roundMultiplier: number = 1.0): number {
  const letterSum = [...word.toUpperCase()].reduce((s, ch) => s + (YOINK_POINTS[ch] ?? 0), 0);
  const lengthBonus = 1 + 0.20 * word.length;
  return Math.round(letterSum * lengthBonus * roundMultiplier);
}

/** Pick a weighted random letter for pool respawn */
export function weightedRandomLetter(): string {
  const entries = Object.entries(LETTER_WEIGHTS);
  const totalWeight = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * totalWeight;
  for (const [letter, weight] of entries) {
    r -= weight;
    if (r <= 0) return letter;
  }
  return "E"; // fallback
}

/** Calculate spawn interval in ms based on current tile count */
export function spawnIntervalMs(currentTileCount: number): number {
  if (currentTileCount >= 16) return Infinity;
  const fullness = currentTileCount; // 0-15
  const intervalSec = 0.5 + (10 - 0.5) * (fullness / 15);
  return intervalSec * 1000;
}
