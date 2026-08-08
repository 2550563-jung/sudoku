(function () {
  "use strict";

  const GAME_KEY = "sudoku-game-v5";
  const SCREEN_KEY = "sudoku-last-screen-v1";
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  const shouldResume = navigation?.type === "reload" && sessionStorage.getItem(SCREEN_KEY) === "game";
  const savedGame = shouldResume ? null : localStorage.getItem(GAME_KEY);

  if (savedGame !== null) {
    localStorage.removeItem(GAME_KEY);
    queueMicrotask(() => {
      localStorage.setItem(GAME_KEY, savedGame);
      document.querySelector("#continueGame")?.classList.remove("hidden");
    });
  }

  function recordCurrentScreen() {
    const gameScreen = document.querySelector("#gameScreen");
    const isPlaying = Boolean(gameScreen && !gameScreen.hidden && !gameScreen.classList.contains("hidden"));
    sessionStorage.setItem(SCREEN_KEY, isPlaying ? "game" : "other");
  }

  const gameScreen = document.querySelector("#gameScreen");
  if (gameScreen && typeof MutationObserver !== "undefined") {
    new MutationObserver(recordCurrentScreen).observe(gameScreen, { attributes: true, attributeFilter: ["class", "hidden"] });
  }
  queueMicrotask(recordCurrentScreen);
  window.addEventListener("beforeunload", recordCurrentScreen, { capture: true });
  window.addEventListener("pagehide", recordCurrentScreen, { capture: true });
})();
