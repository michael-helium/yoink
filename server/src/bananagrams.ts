// server/src/bananagrams.ts — Bananagrams scoring helpers

/**
 * Score a player's grid in Bananagrams mode.
 *
 * Each word scores length² (rewards longer/more complex words).
 * Unused tiles penalise at 3 points each.
 *
 * @param words  Array of uppercase words the player successfully placed
 * @param unusedTileCount  Number of tiles remaining in the player's hand
 * @returns Final score (floored at 0)
 */
export function scoreBananagramsGrid(
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
