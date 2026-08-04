(function (root) {
  "use strict";

  const VERSION = 23;
  const CANDIDATE_COUNT = 28;
  const TARGET_SCORE = 90000;

  function difficultyScore(metrics) {
    return (
      Number(metrics?.nodes || 0) +
      Number(metrics?.backtracks || 0) +
      Number(metrics?.branches || 0) * 8
    );
  }

  function hardestVariant(puzzle, solution, transform, analyze) {
    let best = null;
    const attempts = [];

    for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
      const [nextPuzzle, nextSolution] = transform(puzzle, solution);
      const analysis = analyze(nextPuzzle, 2);
      const score = difficultyScore(analysis.metrics);
      const candidate = { puzzle: nextPuzzle, solution: nextSolution, analysis, score };
      attempts.push(score);
      if (analysis.solutionCount === 1 && (!best || score > best.score)) best = candidate;
      if (best?.score >= TARGET_SCORE && index >= 11) break;
    }

    if (!best) throw new Error("극한 스도쿠 생성에 실패했습니다.");
    return { ...best, attempts };
  }

  const api = Object.freeze({ VERSION, CANDIDATE_COUNT, TARGET_SCORE, difficultyScore, hardestVariant });
  root.SudokuExtremeV23 = api;

  if (
    typeof root.createGame === "function" &&
    typeof root.transformedPair === "function" &&
    root.SudokuCore?.analyzePuzzle
  ) {
    const baseCreateGame = root.createGame;
    root.createGame = function createHarderExtremeGame(difficulty) {
      if (difficulty !== "extreme") return baseCreateGame(difficulty);

      const seed = typeof BASE_PUZZLE !== "undefined" ? Array.from(BASE_PUZZLE) : [];
      const solved = [...seed];
      if (seed.length !== 81 || typeof root.solveBoard !== "function" || !root.solveBoard(solved)) {
        return baseCreateGame(difficulty);
      }

      const chosen = hardestVariant(
        seed,
        solved,
        root.transformedPair,
        root.SudokuCore.analyzePuzzle
      );

      return {
        solution: chosen.solution,
        puzzle: chosen.puzzle,
        values: [...chosen.puzzle],
        given: chosen.puzzle.map(Boolean),
        notes: Array.from({ length: 81 }, () => []),
        selected: -1,
        mistakes: 0,
        seconds: 0,
        paused: false,
        notesMode: false,
        history: [],
        difficulty: "extreme",
        finished: false,
        hints: 0,
        hintsUsed: 0,
        selectedHintUsed: true,
        solutionVerified: true,
        wrongAttempts: {},
        startedAt: Date.now(),
        extremeRating: {
          version: VERSION,
          score: chosen.score,
          candidates: chosen.attempts.length,
          metrics: chosen.analysis.metrics
        }
      };
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
