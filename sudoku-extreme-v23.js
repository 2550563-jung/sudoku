(function (root) {
  "use strict";

  const VERSION = 25;
  // v25: 인간 플레이에서 과도한 추측을 요구하지 않도록 단서를 늘리고,
  // 탐색/백트래킹 점수가 가장 높은 변형을 고르던 방식을 제거한다.
  const CANDIDATE_COUNT = 1;
  const TARGET_SCORE = 0;
  // 28단서의 유일해 고난도 퍼즐. 극한의 난도는 유지하면서도
  // 후보를 무작위로 찍는 대신 논리적 후보 정리로 진행할 수 있게 조정했다.
  const EXTREME_PUZZLE = "000000907000420180000705026100904000050000040000507009920108000034059000507000000"
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
