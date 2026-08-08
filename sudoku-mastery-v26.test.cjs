const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("sudoku-mastery-v24.js", "utf8");
const expected = [
  ["veryEasy", "매우 쉬움", 3], ["easy", "쉬움", 4],
  ["medium", "보통", 5], ["hard", "어려움", 6],
  ["expert", "전문가", 7], ["master", "마스터", 8],
  ["extreme", "극한", 9],
];

for (const [key, label, minutes] of expected) {
  assert.match(source, new RegExp(`\\["${key}", "${label}", ${minutes} \\* 60\\]`));
}
assert.match(source, /id="accountUsername"/);
assert.doesNotMatch(source, /가입 확인 메일/);
console.log("Sudoku mastery v26 limits and username UI passed.");
