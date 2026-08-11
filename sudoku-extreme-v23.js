(function (root) {
  "use strict";

  const VERSION = 24;
  // v24: 극한의 정체성은 유지하되 최상위 후보만 고르던 강도를 조금 완화한다.
  const CANDIDATE_COUNT = 48;
  const TARGET_SCORE = 62000;
  // 단순한 17단서 퍼즐보다 현재 해법 탐색기에서 약 3배 더 많은 탐색을 요구하는
  // 유일해 21단서 기반 퍼즐. 변환 후보 중에서도 가장 어려운 것을 최종 선택한다.
  const EXTREME_PUZZLE = "800000000003600000070090200050007000000045700000100030001000068008500010090000400"
    .split("")
    .map(Number);

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
      if (best?.score >= TARGET_SCORE && index >= 23) break;
    }

    if (!best) throw new Error("극한 스도쿠 생성에 실패했습니다.");
    return { ...best, attempts };
  }

  const api = Object.freeze({ VERSION, CANDIDATE_COUNT, TARGET_SCORE, EXTREME_PUZZLE, difficultyScore, hardestVariant });
  root.SudokuExtremeV23 = api;

  if (
    typeof root.createGame === "function" &&
    typeof root.transformedPair === "function" &&
    root.SudokuCore?.analyzePuzzle
  ) {
    const baseCreateGame = root.createGame;
    root.createGame = function createHarderExtremeGame(difficulty) {
      if (difficulty !== "extreme") return baseCreateGame(difficulty);

      const seed = Array.from(EXTREME_PUZZLE);
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
