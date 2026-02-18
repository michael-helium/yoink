// server/src/yoink-scoring.test.ts — Yoink scoring tests
// Run: npx tsx --test server/src/yoink-scoring.test.ts

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { scoreYoinkGrid, countTiles, YOINK_BONUS, YOINK_PENALTY } from "./yoink-scoring.js";

describe("scoreYoinkGrid", () => {
  it("scores each word as length² and penalises unused tiles", () => {
    // "STONE" (5²=25) + "RUSH" (4²=16) = 41, unused 2 → 41 - 6 = 35
    const score = scoreYoinkGrid(["STONE", "RUSH"], 2);
    assert.equal(score, 35);
  });

  it("returns 0 when penalty exceeds word points", () => {
    // "AT" (4) - 10*3 = -26 → clamped to 0
    assert.equal(scoreYoinkGrid(["AT"], 10), 0);
  });

  it("handles no words played", () => {
    assert.equal(scoreYoinkGrid([], 5), 0);
  });

  it("handles no unused tiles (perfect clear)", () => {
    // "BANANAGRAMS" (11²=121) with 0 leftover
    assert.equal(scoreYoinkGrid(["BANANAGRAMS"], 0), 121);
  });

  it("rewards longer words quadratically", () => {
    // Two 3-letter words: 9+9 = 18
    // One 6-letter word: 36
    // Same 6 tiles but one long word scores double
    assert.ok(
      scoreYoinkGrid(["STONES"], 0) >
        scoreYoinkGrid(["STO", "NES"], 0)
    );
  });
});

describe("YOINK! bonus scoring", () => {
  it("awards 50-point bonus for a valid YOINK! call", () => {
    // Player used all tiles in words, gets grid score + bonus
    const gridScore = scoreYoinkGrid(["STONE", "RUSH"], 0); // 25 + 16 = 41
    const finalScore = gridScore + YOINK_BONUS;
    assert.equal(finalScore, 91);
    assert.equal(YOINK_BONUS, 50);
  });

  it("defines a 10-point penalty for invalid YOINK! call", () => {
    assert.equal(YOINK_PENALTY, 10);
  });

  it("YOINK! with unused tiles does not get bonus", () => {
    // Player still has tiles — no bonus, just grid score with penalty
    const gridScore = scoreYoinkGrid(["STONE"], 3); // 25 - 9 = 16
    assert.equal(gridScore, 16);
    // No YOINK_BONUS added since hand wasn't empty
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
