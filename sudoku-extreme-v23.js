(function (root) {
  "use strict";

  const VERSION = 26;
  // v26: v25의 논리 중심 극한 퍼즐에서 단서 두 개만 더 제거해
  // 난도를 소폭 높였다. 유일해와 나머지 난이도 동작은 그대로 유지한다.
  const CANDIDATE_COUNT = 1;
  const TARGET_SCORE = 0;
  // 26단서의 유일해 고난도 퍼즐. 기존 28단서 퍼즐에서 r3c6과 r6c4만
  // 제거해 체감 난도 변화가 지나치게 커지지 않도록 했다.
  const EXTREME_PUZZLE = "000000907000420180000700026100904000050000040000007009920108000034059000507000000"
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
    const [nextPuzzle, nextSolution] = transform(puzzle, solution);
    const analysis = analyze(nextPuzzle, 2);
    if (analysis.solutionCount !== 1) throw new Error("극한 스도쿠 생성에 실패했습니다.");
    const score = difficultyScore(analysis.metrics);
    return { puzzle: nextPuzzle, solution: nextSolution, analysis, score, attempts: [score] };
  }

  const api = Object.freeze({ VERSION, CANDIDATE_COUNT, TARGET_SCORE, EXTREME_PUZZLE, difficultyScore, hardestVariant });
  root.SudokuExtremeV23 = api;

  if (
    typeof root.createGame === "function" &&
    typeof root.transformedPair === "function" &&
    root.SudokuCore?.analyzePuzzle
  ) {
    const baseCreateGame = root.createGame;
    root.createGame = function createBalancedExtremeGame(difficulty) {
      if (difficulty !== "extreme") return baseCreateGame(difficulty);

      const seed = Array.from(EXTREME_PUZZLE);
      const solved = [...seed];
      if (seed.length !== 81 || typeof root.solveBoard !== "function" || !root.solveBoard(solved)) {
        return baseCreateGame(difficulty);
      }

      const chosen = hardestVariant(seed, solved, root.transformedPair, root.SudokuCore.analyzePuzzle);

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
