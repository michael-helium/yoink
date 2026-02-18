// server/src/bananagrams.test.ts — Bananagrams scoring tests
// Run: npx tsx --test server/src/bananagrams.test.ts   (or ts-node, vitest, etc.)

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { scoreBananagramsGrid, countTiles } from "./bananagrams.js";

describe("scoreBananagramsGrid", () => {
  it("scores each word as length² and penalises unused tiles", () => {
    // "STONE" (5²=25) + "RUSH" (4²=16) = 41, unused 2 → 41 - 6 = 35
    const score = scoreBananagramsGrid(["STONE", "RUSH"], 2);
    assert.equal(score, 35);
  });

  it("returns 0 when penalty exceeds word points", () => {
    // "AT" (4) - 10*3 = -26 → clamped to 0
    assert.equal(scoreBananagramsGrid(["AT"], 10), 0);
  });

  it("handles no words played", () => {
    assert.equal(scoreBananagramsGrid([], 5), 0);
  });

  it("handles no unused tiles (perfect clear)", () => {
    // "BANANAGRAMS" (11²=121) with 0 leftover
    assert.equal(scoreBananagramsGrid(["BANANAGRAMS"], 0), 121);
  });

  it("rewards longer words quadratically", () => {
    // Two 3-letter words: 9+9 = 18
    // One 6-letter word: 36
    // Same 6 tiles but one long word scores double
    assert.ok(
      scoreBananagramsGrid(["STONES"], 0) >
        scoreBananagramsGrid(["STO", "NES"], 0)
    );
  });
});

describe("countTiles", () => {
  it("sums tile counts", () => {
    assert.equal(countTiles({ A: 3, B: 2, _: 1 }), 6);
  });

  it("returns 0 for empty hand", () => {
    assert.equal(countTiles({}), 0);
  });
});
