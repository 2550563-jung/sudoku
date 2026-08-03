(function (root) {
  "use strict";

  const FULL_MASK = 0b1111111110;

  function popcount(value) {
    let count = 0;
    for (let mask = value; mask; mask &= mask - 1) count += 1;
    return count;
  }

  function normalizedBoard(input) {
    if (!Array.isArray(input) || input.length !== 81) return null;
    const board = input.map(Number);
    return board.every(value => Number.isInteger(value) && value >= 0 && value <= 9)
      ? board
      : null;
  }

  function analyzePuzzle(input, solutionLimit = 2) {
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const board = normalizedBoard(input);
    const limit = Math.max(1, Math.min(100, Math.floor(Number(solutionLimit) || 2)));
    const metrics = {
      nodes: 0,
      branches: 0,
      backtracks: 0,
      maxDepth: 0,
      elapsedMs: 0
    };

    if (!board) {
      return { valid: false, solutionCount: 0, solution: null, metrics };
    }

    const rows = new Uint16Array(9);
    const columns = new Uint16Array(9);
    const boxes = new Uint16Array(9);

    for (let index = 0; index < 81; index += 1) {
      const value = board[index];
      if (!value) continue;
      const row = Math.floor(index / 9);
      const column = index % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
      const bit = 1 << value;
      if ((rows[row] | columns[column] | boxes[box]) & bit) {
        return { valid: false, solutionCount: 0, solution: null, metrics };
      }
      rows[row] |= bit;
      columns[column] |= bit;
      boxes[box] |= bit;
    }

    let solutionCount = 0;
    let firstSolution = null;

    function search(depth) {
      if (solutionCount >= limit) return;
      metrics.maxDepth = Math.max(metrics.maxDepth, depth);

      let bestIndex = -1;
      let bestMask = 0;
      let bestCount = 10;

      for (let index = 0; index < 81; index += 1) {
        if (board[index]) continue;
        const row = Math.floor(index / 9);
        const column = index % 9;
        const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
        const mask = FULL_MASK & ~(rows[row] | columns[column] | boxes[box]);
        const count = popcount(mask);
        if (!count) {
          metrics.backtracks += 1;
          return;
        }
        if (count < bestCount) {
          bestIndex = index;
          bestMask = mask;
          bestCount = count;
          if (count === 1) break;
        }
      }

      if (bestIndex < 0) {
        solutionCount += 1;
        if (!firstSolution) firstSolution = [...board];
        return;
      }

      metrics.nodes += 1;
      if (bestCount > 1) metrics.branches += 1;
      const row = Math.floor(bestIndex / 9);
      const column = bestIndex % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);

      for (let value = 1; value <= 9; value += 1) {
        const bit = 1 << value;
        if (!(bestMask & bit)) continue;
        board[bestIndex] = value;
        rows[row] |= bit;
        columns[column] |= bit;
        boxes[box] |= bit;
        search(depth + 1);
        rows[row] ^= bit;
        columns[column] ^= bit;
        boxes[box] ^= bit;
        board[bestIndex] = 0;
        if (solutionCount >= limit) return;
      }
      metrics.backtracks += 1;
    }

    search(0);
    const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    metrics.elapsedMs = Number((finishedAt - startedAt).toFixed(3));
    return {
      valid: solutionCount > 0,
      solutionCount,
      solution: firstSolution,
      metrics
    };
  }

  function countSolutions(board, limit = 2) {
    return analyzePuzzle(board, limit).solutionCount;
  }

  function validatePuzzle(puzzle, expectedSolution, expectedHoles) {
    const board = normalizedBoard(puzzle);
    const solution = normalizedBoard(expectedSolution);
    if (!board || !solution || solution.some(value => value === 0)) {
      return { valid: false, reason: "invalid-shape" };
    }
    const holes = board.filter(value => value === 0).length;
    if (Number.isInteger(expectedHoles) && holes !== expectedHoles) {
      return { valid: false, reason: "unexpected-hole-count", holes };
    }
    if (board.some((value, index) => value && value !== solution[index])) {
      return { valid: false, reason: "clue-mismatch", holes };
    }
    const analysis = analyzePuzzle(board, 2);
    if (analysis.solutionCount !== 1) {
      return {
        valid: false,
        reason: analysis.solutionCount ? "multiple-solutions" : "unsolvable",
        holes,
        metrics: analysis.metrics
      };
    }
    if (analysis.solution.some((value, index) => value !== solution[index])) {
      return { valid: false, reason: "solution-mismatch", holes, metrics: analysis.metrics };
    }
    return { valid: true, holes, metrics: analysis.metrics };
  }

  const api = Object.freeze({ analyzePuzzle, countSolutions, validatePuzzle });
  root.SudokuCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
