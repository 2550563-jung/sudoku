const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("sudoku-entry-v26.js", "utf8");

async function run(type, previousScreen) {
  const local = new Map([["sudoku-game-v5", "saved-game"]]);
  const session = new Map(previousScreen ? [["sudoku-last-screen-v1", previousScreen]] : []);
  let continueVisible = false;
  const listeners = {};
  const storage = (map) => ({ getItem: (key) => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) });
  vm.runInNewContext(source, {
    performance: { getEntriesByType: () => [{ type }] },
    localStorage: storage(local), sessionStorage: storage(session), queueMicrotask,
    window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    setTimeout, document: { readyState: "loading", querySelector: (selector) => selector === "#continueGame" ? { classList: { remove: () => { continueVisible = true; } } } : null }
  });
  listeners.load?.();
  await new Promise(queueMicrotask);
  return { gameAvailable: local.has("sudoku-game-v5"), continueVisible };
}

(async () => {
  assert.deepEqual(await run("navigate", null), { gameAvailable: true, continueVisible: true });
  assert.deepEqual(await run("reload", "other"), { gameAvailable: true, continueVisible: true });
  assert.deepEqual(await run("reload", "game"), { gameAvailable: true, continueVisible: false });
  console.log("Sudoku entry v26 reload rules passed.");
})();
