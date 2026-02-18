// Classic mode scoring (Scrabble-style)
export const POINTS: Record<string, number> = {
  "_": 0,
  E:1,A:1,O:1,T:1,I:1,N:1,R:1,S:1,L:1,U:1,
  D:2,G:2,
  C:3,M:3,B:3,P:3,
  H:4,F:4,W:4,Y:4,V:4,
  K:5,J:8,X:8,Q:10,Z:10
};

export function scoreWord(word: string): number {
  const base = [...word].reduce((s,ch)=>s+(POINTS[ch]??0),0);
  const bonus = 1 + 0.05 * word.length;
  return Math.round(base * bonus);
}

/** Yoink grid score (legacy): Σ(length²) − 3×unused. Floored at 0. */
export function scoreYoinkGrid(words: string[], unusedTileCount: number): number {
  const pts = words.reduce((s, w) => s + w.length * w.length, 0);
  return Math.max(0, pts - unusedTileCount * 3);
}

// ===== New Yoink mode scoring =====

/** Letter point values for yoink mode */
export const YOINK_POINTS: Record<string, number> = {
  A: 10, B: 20, C: 20, D: 10, E: 10, F: 20, G: 10, H: 20, I: 10,
  J: 30, K: 20, L: 10, M: 20, N: 10, O: 10, P: 20, Q: 30, R: 10,
  S: 10, T: 10, U: 10, V: 20, W: 20, X: 30, Y: 20, Z: 30,
};

/** Point tier for a letter (10, 20, or 30) */
export function yoinkPointTier(letter: string): 10 | 20 | 30 {
  const pts = YOINK_POINTS[letter.toUpperCase()] ?? 10;
  return pts as 10 | 20 | 30;
}

/**
 * Score a word in yoink mode.
 * Formula: Sum(letter_values) × (1 + 0.20 × word_length) × round_multiplier
 */
export function scoreYoinkWord(word: string, roundMultiplier: number = 1.0): number {
  const letterSum = [...word.toUpperCase()].reduce((s, ch) => s + (YOINK_POINTS[ch] ?? 0), 0);
  const lengthBonus = 1 + 0.20 * word.length;
  return Math.round(letterSum * lengthBonus * roundMultiplier);
}

/** Round multipliers */
export const ROUND_MULTIPLIERS = [1.0, 1.2, 1.5];
