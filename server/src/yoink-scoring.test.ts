// server/src/yoink-scoring.test.ts — Yoink scoring tests
// Run: npx tsx --test server/src/yoink-scoring.test.ts

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  scoreYoinkGrid, countTiles, YOINK_BONUS, YOINK_PENALTY,
  scoreYoinkWord, YOINK_POINTS, weightedRandomLetter, spawnIntervalMs, ROUND_MULTIPLIERS
} from "./yoink-scoring.js";

// ===== Legacy scoring tests (kept for backward compat) =====

describe("scoreYoinkGrid", () => {
  it("scores each word as length² and penalises unused tiles", () => {
    const score = scoreYoinkGrid(["STONE", "RUSH"], 2);
    assert.equal(score, 35);
  });

  it("returns 0 when penalty exceeds word points", () => {
    assert.equal(scoreYoinkGrid(["AT"], 10), 0);
  });

  it("handles no words played", () => {
    assert.equal(scoreYoinkGrid([], 5), 0);
  });

  it("handles no unused tiles (perfect clear)", () => {
    assert.equal(scoreYoinkGrid(["BANANAGRAMS"], 0), 121);
  });

  it("rewards longer words quadratically", () => {
    assert.ok(
      scoreYoinkGrid(["STONES"], 0) >
        scoreYoinkGrid(["STO", "NES"], 0)
    );
  });
});

describe("YOINK! bonus scoring", () => {
  it("awards 50-point bonus for a valid YOINK! call", () => {
    const gridScore = scoreYoinkGrid(["STONE", "RUSH"], 0);
    const finalScore = gridScore + YOINK_BONUS;
    assert.equal(finalScore, 91);
    assert.equal(YOINK_BONUS, 50);
  });

  it("defines a 10-point penalty for invalid YOINK! call", () => {
    assert.equal(YOINK_PENALTY, 10);
  });

  it("YOINK! with unused tiles does not get bonus", () => {
    const gridScore = scoreYoinkGrid(["STONE"], 3);
    assert.equal(gridScore, 16);
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

// ===== New Yoink mode scoring (10/20/30 + length bonus + multiplier) =====

describe("YOINK_POINTS", () => {
  it("has correct 10pt letters", () => {
    for (const ch of "ADEGILNORSTU") {
      assert.equal(YOINK_POINTS[ch], 10, `${ch} should be 10 pts`);
    }
  });

  it("has correct 20pt letters", () => {
    for (const ch of "BCFHKMPVWY") {
      assert.equal(YOINK_POINTS[ch], 20, `${ch} should be 20 pts`);
    }
  });

  it("has correct 30pt letters", () => {
    for (const ch of "JQXZ") {
      assert.equal(YOINK_POINTS[ch], 30, `${ch} should be 30 pts`);
    }
  });
});

describe("scoreYoinkWord", () => {
  it("scores a simple 3-letter word at multiplier 1.0", () => {
    // "CAT" = C(20) + A(10) + T(10) = 40, length bonus = 1 + 0.20*3 = 1.6
    // 40 * 1.6 = 64
    assert.equal(scoreYoinkWord("CAT", 1.0), 64);
  });

  it("scores a 5-letter word at multiplier 1.0", () => {
    // "STONE" = S(10) + T(10) + O(10) + N(10) + E(10) = 50
    // length bonus = 1 + 0.20*5 = 2.0
    // 50 * 2.0 = 100
    assert.equal(scoreYoinkWord("STONE", 1.0), 100);
  });

  it("applies round multiplier correctly (R2 = 1.2)", () => {
    // "CAT" = 40 * 1.6 * 1.2 = 76.8 → 77
    assert.equal(scoreYoinkWord("CAT", 1.2), 77);
  });

  it("applies round multiplier correctly (R3 = 1.5)", () => {
    // "CAT" = 40 * 1.6 * 1.5 = 96
    assert.equal(scoreYoinkWord("CAT", 1.5), 96);
  });

  it("rewards high-value letters", () => {
    // "JAX" = J(30) + A(10) + X(30) = 70, bonus = 1.6, → 70*1.6 = 112
    assert.equal(scoreYoinkWord("JAX", 1.0), 112);
  });

  it("scores a 7-letter word (max bank)", () => {
    // "JESTING" = J(30)+E(10)+S(10)+T(10)+I(10)+N(10)+G(10) = 90
    // bonus = 1 + 0.20*7 = 2.4
    // 90 * 2.4 = 216
    assert.equal(scoreYoinkWord("JESTING", 1.0), 216);
  });

  it("is case-insensitive", () => {
    assert.equal(scoreYoinkWord("cat", 1.0), scoreYoinkWord("CAT", 1.0));
  });

  it("defaults multiplier to 1.0", () => {
    assert.equal(scoreYoinkWord("CAT"), scoreYoinkWord("CAT", 1.0));
  });
});

describe("ROUND_MULTIPLIERS", () => {
  it("has correct values", () => {
    assert.deepEqual(ROUND_MULTIPLIERS, [1.0, 1.2, 1.5]);
  });
});

describe("weightedRandomLetter", () => {
  it("returns a valid uppercase letter", () => {
    for (let i = 0; i < 100; i++) {
      const letter = weightedRandomLetter();
      assert.ok(/^[A-Z]$/.test(letter), `got "${letter}"`);
    }
  });
});

describe("spawnIntervalMs", () => {
  it("returns 500ms at 0 tiles", () => {
    assert.equal(spawnIntervalMs(0), 500);
  });

  it("returns 10000ms at 15 tiles", () => {
    assert.equal(spawnIntervalMs(15), 10000);
  });

  it("returns Infinity at 16 tiles", () => {
    assert.equal(spawnIntervalMs(16), Infinity);
  });

  it("returns a value between 500 and 10000 for mid-range", () => {
    const interval = spawnIntervalMs(8);
    assert.ok(interval > 500 && interval < 10000);
  });
});
