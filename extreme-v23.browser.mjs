import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "file:///C:/Users/commo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";

const root = process.cwd();
const server = http.createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(request.url.split("?")[0]) === "/" ? "/index.html" : decodeURIComponent(request.url.split("?")[0]);
    const target = path.resolve(root, `.${relative}`);
    if (!target.startsWith(root)) throw new Error("forbidden");
    const data = await fs.readFile(target);
    const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png" };
    response.setHeader("Content-Type", mime[path.extname(target)] || "application/octet-stream");
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(String(error.stack || error)));
await page.route("**/*", route => route.request().url().startsWith(baseUrl) ? route.continue() : route.abort());
await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => window.SudokuExtremeV23?.VERSION === 23);
const result = await page.evaluate(() => {
  const game = createGame("extreme");
  return {
    clues: game.puzzle.filter(Boolean).length,
    solutions: SudokuCore.countSolutions(game.puzzle, 2),
    hints: game.hints,
    rating: game.extremeRating,
    solutionMatches: game.puzzle.every((value, index) => !value || value === game.solution[index])
  };
});
assert.equal(result.clues, 17);
assert.equal(result.solutions, 1);
assert.equal(result.hints, 0);
assert.equal(result.rating.version, 23);
assert.ok(result.rating.candidates >= 12);
assert.ok(result.rating.score > 0);
assert.equal(result.solutionMatches, true);
assert.deepEqual(errors, []);
console.log("Sudoku extreme v23 browser test passed.", result);
await browser.close();
await new Promise(resolve => server.close(resolve));
