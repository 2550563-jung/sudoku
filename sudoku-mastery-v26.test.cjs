const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("sudoku-mastery-v24.js", "utf8");
const expected = [
  ["veryEasy", "매우 쉬움", "3 \\* 60"], ["easy", "쉬움", "3 \\* 60 \\+ 10"],
  ["medium", "보통", "4 \\* 60 \\+ 20"], ["hard", "어려움", "5 \\* 60 \\+ 30"],
  ["expert", "전문가", "6 \\* 60 \\+ 40"], ["master", "마스터", "7 \\* 60 \\+ 50"],
  ["extreme", "극한", "9 \\* 60"],
];

for (const [key, label, limit] of expected) {
  assert.match(source, new RegExp(`\\["${key}", "${label}", ${limit}\\]`));
}
assert.match(source, /id="accountUsername"/);
assert.match(source, /id="sudokuAdminCode"/);
assert.doesNotMatch(source, /12201220/);
assert.doesNotMatch(source, /가입 확인 메일/);
console.log("Sudoku mastery v26 limits and username UI passed.");
