const assert = require("node:assert/strict");
const core = require("./sudoku-core.js");
const extreme = require("./sudoku-extreme-v23.js");

const solution = core.analyzePuzzle(extreme.EXTREME_PUZZLE, 2).solution;
let transforms = 0;
const result = extreme.hardestVariant(
  extreme.EXTREME_PUZZLE,
  solution,
  (puzzle, solved) => {
    transforms += 1;
    return [[...puzzle], [...solved]];
  },
  core.analyzePuzzle
);

assert.equal(extreme.VERSION, 25);
assert.equal(extreme.CANDIDATE_COUNT, 1);
assert.equal(result.analysis.solutionCount, 1);
assert.equal(result.puzzle.filter(Boolean).length, 28);
assert.equal(result.solution.length, 81);
assert.equal(result.attempts.length, 1);
assert.equal(transforms, 1);
assert.equal(result.score, result.attempts[0]);
assert.ok(result.score > 0);
console.log("Sudoku extreme v25 balance test passed.", {
  score: result.score,
  candidates: result.attempts.length,
  clues: result.puzzle.filter(Boolean).length
});
