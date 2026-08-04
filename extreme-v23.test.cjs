const assert = require("node:assert/strict");
const core = require("./sudoku-core.js");
const extreme = require("./sudoku-extreme-v23.js");

const base = "000000010400000000020000000000050407008000300001090000300400200050100000000806000"
  .split("")
  .map(Number);
const solution = core.analyzePuzzle(base, 2).solution;

function rotateDigits(puzzle, offset) {
  return puzzle.map(value => (value ? ((value + offset - 1) % 9) + 1 : 0));
}

let transformIndex = 0;
const result = extreme.hardestVariant(
  base,
  solution,
  (puzzle, solved) => {
    const offset = transformIndex++ % 9;
    return [rotateDigits(puzzle, offset), rotateDigits(solved, offset)];
  },
  core.analyzePuzzle
);

assert.equal(extreme.VERSION, 23);
assert.equal(result.analysis.solutionCount, 1);
assert.equal(result.puzzle.filter(Boolean).length, 17);
assert.equal(result.solution.length, 81);
assert.equal(result.attempts.length, extreme.CANDIDATE_COUNT);
assert.equal(result.score, Math.max(...result.attempts));
assert.ok(result.score > 0);
console.log("Sudoku extreme v23 selection test passed.", {
  score: result.score,
  candidates: result.attempts.length,
  clues: result.puzzle.filter(Boolean).length
});
