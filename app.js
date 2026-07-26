"use strict";

const $ = selector => document.querySelector(selector);
const DIFFICULTIES = [
  ["veryEasy", "매우 쉬움", 32, 1],
  ["easy", "쉬움", 38, 1.15],
  ["medium", "보통", 45, 1.35],
  ["hard", "어려움", 50, 1.65],
  ["expert", "전문가", 54, 2],
  ["master", "마스터", 57, 2.4],
  ["extreme", "극한", 60, 3]
];
const THEMES = [
  ["파랑", "#2563eb", "#dbeafe", "#1d4ed8"], ["하늘", "#0284c7", "#e0f2fe", "#0369a1"],
  ["청록", "#0f766e", "#ccfbf1", "#115e59"], ["민트", "#059669", "#d1fae5", "#047857"],
  ["초록", "#16a34a", "#dcfce7", "#15803d"], ["라임", "#65a30d", "#ecfccb", "#4d7c0f"],
  ["노랑", "#ca8a04", "#fef9c3", "#a16207"], ["주황", "#ea580c", "#ffedd5", "#c2410c"],
  ["빨강", "#dc2626", "#fee2e2", "#b91c1c"], ["분홍", "#db2777", "#fce7f3", "#be185d"],
  ["보라", "#7c3aed", "#ede9fe", "#6d28d9"], ["남색", "#4338ca", "#e0e7ff", "#3730a3"],
  ["갈색", "#92400e", "#fef3c7", "#78350f"], ["회색", "#64748b", "#e2e8f0", "#475569"],
  ["검정", "#0f172a", "#e2e8f0", "#020617"]
];
const GAME_KEY = "sudoku-game-v5";
const PROFILE_KEY = "sudoku-profile-v5";
const THEME_KEY = "sudoku-theme-v5";

const emptyProfile = () => ({
  played: 0, wins: 0, totalScore: 0, totalWinSeconds: 0, maxSeconds: 0,
  maxScore: 0, maxDifficulty: -1, perfectWins: 0, streak: 0, bestStreak: 0, xp: 0
});

let profile = normalizedProfile(loadJSON(PROFILE_KEY, null));
let selectedDifficulty = "medium";
let state = null;
let currentScreen = "homeScreen";

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizedProfile(value) {
  const base = emptyProfile();
  if (!value || typeof value !== "object") return base;
  for (const key of Object.keys(base)) {
    const number = Number(value[key]);
    base[key] = Number.isFinite(number) ? Math.max(key === "maxDifficulty" ? -1 : 0, number) : base[key];
  }
  return base;
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function difficulty() {
  return DIFFICULTIES.find(item => item[0] === (state?.difficulty || selectedDifficulty)) || DIFFICULTIES[2];
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function levelInfo() {
  let level = 1;
  let current = profile.xp;
  while (current >= level * 500) {
    current -= level * 500;
    level += 1;
  }
  return { level, current, needed: level * 500 };
}

function shuffle(source) {
  const result = [...source];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isValid(board, row, column, number) {
  for (let index = 0; index < 9; index += 1) {
    if (board[row * 9 + index] === number || board[index * 9 + column] === number) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      if (board[(boxRow + y) * 9 + boxColumn + x] === number) return false;
    }
  }
  return true;
}

function fillBoard(board, position = 0) {
  while (position < 81 && board[position]) position += 1;
  if (position >= 81) return true;
  const row = Math.floor(position / 9);
  const column = position % 9;
  for (const number of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (!isValid(board, row, column, number)) continue;
    board[position] = number;
    if (fillBoard(board, position + 1)) return true;
    board[position] = 0;
  }
  return false;
}

function solveBoard(board) {
  let position = -1;
  let bestCandidates = null;
  for (let i = 0; i < 81; i += 1) {
    if (board[i]) continue;
    const row = Math.floor(i / 9);
    const column = i % 9;
    const candidates = [];
    for (let number = 1; number <= 9; number += 1) {
      if (isValid(board, row, column, number)) candidates.push(number);
    }
    if (!candidates.length) return false;
    if (!bestCandidates || candidates.length < bestCandidates.length) {
      position = i;
      bestCandidates = candidates;
      if (candidates.length === 1) break;
    }
  }
  if (position < 0) return true;
  for (const number of shuffle(bestCandidates)) {
    board[position] = number;
    if (solveBoard(board)) return true;
    board[position] = 0;
  }
  return false;
}

function countSolutions(board, limit = 2) {
  let position = -1;
  let bestCandidates = null;
  for (let i = 0; i < 81; i += 1) {
    if (board[i]) continue;
    const row = Math.floor(i / 9);
    const column = i % 9;
    const candidates = [];
    for (let number = 1; number <= 9; number += 1) {
      if (isValid(board, row, column, number)) candidates.push(number);
    }
    if (!candidates.length) return 0;
    if (!bestCandidates || candidates.length < bestCandidates.length) {
      position = i;
      bestCandidates = candidates;
      if (candidates.length === 1) break;
    }
  }
  if (position < 0) return 1;
  let count = 0;
  for (const number of bestCandidates) {
    board[position] = number;
    count += countSolutions(board, limit - count);
    board[position] = 0;
    if (count >= limit) return count;
  }
  return count;
}

const BASE_PUZZLE = (
  "000000010" +
  "400000000" +
  "020000000" +
  "000050407" +
  "008000300" +
  "001090000" +
  "300400200" +
  "050100000" +
  "000806000"
).split("").map(Number);

function transformedPair(puzzle, solution) {
  const digitMap = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])];
  const bands = shuffle([0, 1, 2]);
  const stacks = shuffle([0, 1, 2]);
  const rows = bands.flatMap(band => shuffle([0, 1, 2]).map(row => band * 3 + row));
  const columns = stacks.flatMap(stack => shuffle([0, 1, 2]).map(column => stack * 3 + column));
  const transpose = Math.random() < 0.5;
  const transform = board => {
    const result = Array(81).fill(0);
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const sourceRow = transpose ? columns[column] : rows[row];
        const sourceColumn = transpose ? rows[row] : columns[column];
        result[row * 9 + column] = digitMap[board[sourceRow * 9 + sourceColumn]];
      }
    }
    return result;
  };
  return [transform(puzzle), transform(solution)];
}

function createGame(difficultyId) {
  const config = DIFFICULTIES.find(item => item[0] === difficultyId) || DIFFICULTIES[2];
  const baseSolution = [...BASE_PUZZLE];
  solveBoard(baseSolution);
  const basePuzzle = [...BASE_PUZZLE];
  let holes = basePuzzle.filter(value => !value).length;
  for (const index of shuffle([...Array(81).keys()])) {
    if (holes <= config[2]) break;
    if (!basePuzzle[index]) {
      basePuzzle[index] = baseSolution[index];
      holes -= 1;
    }
  }
  const [puzzle, solution] = transformedPair(basePuzzle, baseSolution);
  const hints = difficultyId === "extreme" ? 0 : 1 + Math.floor(Math.random() * 4);
  return {
    solution, puzzle, values: [...puzzle], given: puzzle.map(Boolean),
    notes: Array.from({ length: 81 }, () => []), selected: -1, mistakes: 0,
    seconds: 0, paused: false, notesMode: false, history: [], difficulty: difficultyId,
    finished: false, hints, hintsUsed: 0, selectedHintUsed: false, startedAt: Date.now()
  };
}

function normalizeGame(value) {
  if (!value || !Array.isArray(value.solution) || value.solution.length !== 81 ||
      !Array.isArray(value.values) || value.values.length !== 81 || value.finished) return null;
  const difficultyId = DIFFICULTIES.some(item => item[0] === value.difficulty) ? value.difficulty : "medium";
  const puzzle = Array.isArray(value.puzzle) && value.puzzle.length === 81 ? value.puzzle : value.values;
  return {
    ...value,
    puzzle: [...puzzle],
    given: Array.isArray(value.given) && value.given.length === 81 ? value.given.map(Boolean) : puzzle.map(Boolean),
    notes: Array.from({ length: 81 }, (_, i) => Array.isArray(value.notes?.[i]) ? value.notes[i].filter(n => n >= 1 && n <= 9) : []),
    selected: Number.isInteger(value.selected) && value.selected >= -1 && value.selected < 81 ? value.selected : -1,
    mistakes: Math.max(0, Math.min(3, Number(value.mistakes) || 0)),
    seconds: Math.max(0, Number(value.seconds) || 0),
    paused: Boolean(value.paused),
    notesMode: Boolean(value.notesMode),
    history: Array.isArray(value.history) ? value.history.slice(-100) : [],
    difficulty: difficultyId,
    hints: difficultyId === "extreme" ? 0 : Math.max(0, Number(value.hints) || 0),
    hintsUsed: Math.max(0, Number(value.hintsUsed) || 0),
    selectedHintUsed: Boolean(value.selectedHintUsed),
    finished: false
  };
}

function savedGame() {
  return normalizeGame(loadJSON(GAME_KEY, null));
}

function saveGame() {
  if (state && !state.finished) localStorage.setItem(GAME_KEY, JSON.stringify(state));
}

function show(screenId) {
  ["homeScreen", "gameScreen", "statsScreen", "resultScreen"].forEach(id => {
    const element = $(`#${id}`);
    const hidden = id !== screenId;
    element.classList.toggle("hidden", hidden);
    element.hidden = hidden;
  });
  currentScreen = screenId;
  $("#themePanel").classList.add("hidden");
  $("#themeToggle").setAttribute("aria-expanded", "false");
  if (screenId === "homeScreen") renderHome();
  if (screenId === "statsScreen") renderStats();
  window.scrollTo(0, 0);
}

function renderHome() {
  const level = levelInfo();
  $("#homeLevel").textContent = level.level;
  $("#homeXpText").textContent = `${profile.xp.toLocaleString()} XP · 다음 레벨까지 ${(level.needed - level.current).toLocaleString()} XP`;
  $("#homeXpBar").style.width = `${level.current / level.needed * 100}%`;
  $("#homeXpBar").parentElement.setAttribute("aria-valuenow", String(level.current));
  $("#homeXpBar").parentElement.setAttribute("aria-valuemax", String(level.needed));
  $("#homeStreak").textContent = profile.streak;
  $("#continueGame").classList.toggle("hidden", !savedGame());
  document.querySelectorAll(".difficulty").forEach(button => button.classList.toggle("active", button.dataset.difficulty === selectedDifficulty));
}

function startNew(force = false) {
  if (savedGame() && !force) {
    confirmModal(
      "새 게임을 시작할까요?",
      "현재 진행 중인 게임을 삭제하고 새 게임을 시작합니다.",
      "새 게임 시작",
      () => startNew(true)
    );
    return;
  }
  state = createGame(selectedDifficulty);
  localStorage.removeItem(GAME_KEY);
  saveGame();
  show("gameScreen");
  renderGame();
}

function continueGame() {
  state = savedGame();
  if (!state) {
    renderHome();
    return;
  }
  state.paused = false;
  show("gameScreen");
  renderGame();
}

function createNotes(numbers) {
  const grid = document.createElement("span");
  grid.className = "notes-grid";
  for (let number = 1; number <= 9; number += 1) {
    const item = document.createElement("span");
    item.textContent = numbers.includes(number) ? number : "";
    grid.appendChild(item);
  }
  return grid;
}

function renderGame() {
  if (!state) return;
  const board = $("#board");
  board.innerHTML = "";
  const selectedRow = state.selected >= 0 ? Math.floor(state.selected / 9) : -1;
  const selectedColumn = state.selected >= 0 ? state.selected % 9 : -1;
  const selectedValue = state.selected >= 0 ? state.values[state.selected] : 0;

  state.values.forEach((value, index) => {
    const cell = document.createElement("button");
    const row = Math.floor(index / 9);
    const column = index % 9;
    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${row + 1}행 ${column + 1}열${value ? `, ${value}` : ", 빈 칸"}`);
    if (state.given[index]) cell.classList.add("given");
    if (column === 2 || column === 5) cell.classList.add("box-right");
    if (row === 2 || row === 5) cell.classList.add("box-bottom");
    if (state.selected >= 0) {
      const sameBox = Math.floor(row / 3) === Math.floor(selectedRow / 3) &&
        Math.floor(column / 3) === Math.floor(selectedColumn / 3);
      if (row === selectedRow || column === selectedColumn || sameBox) cell.classList.add("peer");
      if (selectedValue && value === selectedValue) cell.classList.add("same");
      if (index === state.selected) cell.classList.add("selected");
    }
    if (value && !state.given[index] && value !== state.solution[index]) cell.classList.add("bad");
    if (value) cell.textContent = value;
    else if (state.notes[index]?.length) cell.appendChild(createNotes(state.notes[index]));
    cell.addEventListener("click", () => {
      if (state.paused || state.finished) return;
      state.selected = index;
      renderGame();
      saveGame();
    });
    board.appendChild(cell);
  });

  $("#difficultyLabel").textContent = difficulty()[1];
  $("#mistakes").textContent = `${state.mistakes} / 3`;
  $("#timer").textContent = formatTime(state.seconds);
  $("#hintCount").textContent = state.difficulty === "extreme" ? "없음" : state.hints;
  $("#pauseOverlay").classList.toggle("hidden", !state.paused);
  $("#notes").classList.toggle("active", state.notesMode);
  $("#hint").disabled = state.difficulty === "extreme" || state.hints <= 0;
}

function remember(index) {
  state.history.push({ index, value: state.values[index], notes: [...(state.notes[index] || [])] });
  if (state.history.length > 100) state.history.shift();
}

function removePeerNotes(index, number) {
  const targetRow = Math.floor(index / 9);
  const targetColumn = index % 9;
  for (let i = 0; i < 81; i += 1) {
    const row = Math.floor(i / 9);
    const column = i % 9;
    const sameBox = Math.floor(row / 3) === Math.floor(targetRow / 3) &&
      Math.floor(column / 3) === Math.floor(targetColumn / 3);
    if (row === targetRow || column === targetColumn || sameBox) {
      state.notes[i] = (state.notes[i] || []).filter(value => value !== number);
    }
  }
}

function place(number) {
  if (!state || state.paused || state.finished || state.selected < 0 || state.given[state.selected]) return;
  const index = state.selected;
  remember(index);
  if (state.notesMode && number) {
    state.values[index] = 0;
    const notes = new Set(state.notes[index] || []);
    if (notes.has(number)) notes.delete(number);
    else notes.add(number);
    state.notes[index] = [...notes].sort();
    renderGame();
    saveGame();
    return;
  }

  state.notes[index] = [];
  state.values[index] = number;
  if (number && number !== state.solution[index]) {
    state.mistakes += 1;
    $("#message").textContent = "올바른 숫자가 아닙니다.";
    if (state.mistakes >= 3) {
      finish(false);
      return;
    }
  } else {
    $("#message").textContent = "";
    if (number) removePeerNotes(index, number);
  }
  if (state.values.every((value, i) => value === state.solution[i])) {
    finish(true);
    return;
  }
  renderGame();
  saveGame();
}

function undo() {
  if (!state?.history.length || state.paused || state.finished) return;
  const previous = state.history.pop();
  state.values[previous.index] = previous.value;
  state.notes[previous.index] = previous.notes;
  state.selected = previous.index;
  renderGame();
  saveGame();
}

function useHint() {
  if (!state || state.paused || state.finished || state.difficulty === "extreme" || state.hints <= 0) return;
  const candidates = state.values
    .map((value, index) => (!state.given[index] && value !== state.solution[index] ? index : -1))
    .filter(index => index >= 0);
  if (!candidates.length) return;

  let index;
  if (!state.selectedHintUsed && state.selected >= 0 && candidates.includes(state.selected)) {
    index = state.selected;
    state.selectedHintUsed = true;
  } else {
    index = candidates[Math.floor(Math.random() * candidates.length)];
  }
  state.hints -= 1;
  state.hintsUsed += 1;
  if (Math.random() < 0.01) {
    $("#message").textContent = "힌트가 실패했습니다. 힌트 1개가 소모되었습니다.";
    renderGame();
    saveGame();
    return;
  }

  remember(index);
  state.selected = index;
  state.values[index] = state.solution[index];
  state.notes[index] = [];
  removePeerNotes(index, state.solution[index]);
  $("#message").textContent = "힌트로 한 칸을 공개했습니다.";
  if (state.values.every((value, i) => value === state.solution[i])) {
    finish(true);
    return;
  }
  renderGame();
  saveGame();
}

function calculateScore() {
  const [, , , multiplier] = difficulty();
  const base = 1000 * multiplier;
  const timePenalty = Math.min(650, state.seconds * 0.55);
  const mistakePenalty = state.mistakes * 130;
  const hintPenalty = state.hintsUsed * 90;
  return Math.max(100, Math.round(base - timePenalty - mistakePenalty - hintPenalty));
}

function finish(win) {
  state.finished = true;
  profile.played += 1;
  const score = win ? calculateScore() : 0;
  const xp = win ? Math.max(40, Math.round(score * 0.22)) : 10;
  if (win) {
    profile.wins += 1;
    profile.totalScore += score;
    profile.totalWinSeconds += state.seconds;
    profile.maxSeconds = Math.max(profile.maxSeconds, state.seconds);
    profile.maxScore = Math.max(profile.maxScore, score);
    profile.maxDifficulty = Math.max(profile.maxDifficulty, DIFFICULTIES.findIndex(item => item[0] === state.difficulty));
    if (state.mistakes === 0) profile.perfectWins += 1;
    profile.streak += 1;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
  } else {
    profile.streak = 0;
  }
  profile.xp += xp;
  saveProfile();
  localStorage.removeItem(GAME_KEY);
  renderResult(win, score, xp);
  show("resultScreen");
}

function renderResult(win, score, xp) {
  $("#resultEyebrow").textContent = win ? "CLEAR" : "GAME OVER";
  $("#resultTitle").textContent = win ? "완성했습니다!" : "게임이 종료되었습니다";
  $("#resultSubtitle").textContent = win
    ? `+${xp} XP를 획득했습니다.`
    : "실수 3회로 실패했습니다. 플레이 기록과 XP가 반영되었습니다.";
  const data = [
    ["난이도", difficulty()[1]], ["점수", score.toLocaleString()],
    ["완료 시간", formatTime(state.seconds)], ["실수", `${state.mistakes}회`],
    ["힌트 사용", `${state.hintsUsed}회`], ["획득 XP", `+${xp}`]
  ];
  $("#resultGrid").innerHTML = data.map(([label, value]) =>
    `<div class="result-item"><small>${label}</small><strong>${value}</strong></div>`).join("");
}

function renderStats() {
  const level = levelInfo();
  const averageScore = profile.wins ? Math.round(profile.totalScore / profile.wins) : 0;
  const averageTime = profile.wins ? Math.round(profile.totalWinSeconds / profile.wins) : 0;
  const maxDifficulty = profile.maxDifficulty >= 0 ? DIFFICULTIES[profile.maxDifficulty][1] : "없음";
  $("#statsLevel").textContent = level.level;
  $("#statsXp").textContent = profile.xp.toLocaleString();
  $("#statsStreak").textContent = `${profile.streak} / ${profile.bestStreak}`;
  const items = [
    ["해본 횟수", profile.played], ["성공 횟수", profile.wins],
    ["평균 점수", averageScore.toLocaleString()], ["평균 완료 시간", formatTime(averageTime)],
    ["최대 시간", formatTime(profile.maxSeconds)], ["최대 점수", profile.maxScore.toLocaleString()],
    ["성공한 최고 난이도", maxDifficulty], ["실수 없이 성공", profile.perfectWins],
    ["현재 연승", profile.streak], ["최고 연승", profile.bestStreak],
    ["레벨", level.level], ["누적 XP", profile.xp.toLocaleString()]
  ];
  $("#statsGrid").innerHTML = items.map(([label, value]) =>
    `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`).join("");
}

function openModal(title, html, actions) {
  $("#modalTitle").textContent = title;
  $("#modalText").innerHTML = html;
  $("#modalActions").innerHTML = "";
  actions.forEach(([label, callback, className]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = className || "";
    button.addEventListener("click", () => {
      closeModal();
      callback?.();
    });
    $("#modalActions").appendChild(button);
  });
  $("#modal").classList.remove("hidden");
  $("#modalActions button:last-child")?.focus();
}

function closeModal() {
  $("#modal").classList.add("hidden");
}

function confirmModal(title, text, confirmLabel, callback) {
  openModal(title, `<p>${text}</p>`, [
    ["취소", null, "secondary"],
    [confirmLabel, callback, "primary"]
  ]);
}

function showGuide() {
  openModal("게임 설명", `<div class="guide">
    <h3>기본 규칙</h3><p>각 행, 열, 3×3 영역에 1부터 9까지의 숫자가 한 번씩 들어가도록 빈칸을 채우세요.</p>
    <h3>실수와 종료</h3><p>틀린 숫자를 입력하면 실수가 1회 증가하며, 3회가 되면 즉시 실패합니다.</p>
    <h3>힌트</h3><p>극한을 제외한 게임에는 1~4개의 힌트가 주어집니다. 첫 힌트는 선택한 빈칸에, 이후에는 필요한 칸 중 하나에 사용됩니다. 각 힌트는 1% 확률로 실패하며 실패해도 소모됩니다.</p>
    <h3>점수 · XP · 레벨</h3><p>난이도가 높을수록 기본 점수가 높습니다. 시간, 실수, 힌트 사용량이 최종 점수에 반영됩니다. 성공하면 점수에 따라 XP를 얻고 레벨이 올라갑니다.</p>
    <h3>연승</h3><p>성공하면 연승이 증가하고 실패하면 현재 연승이 0으로 초기화됩니다.</p>
  </div>`, [["확인", null, "primary"]]);
}

function applyTheme(index) {
  const safeIndex = Number.isInteger(index) && THEMES[index] ? index : 0;
  const theme = THEMES[safeIndex];
  const root = document.documentElement.style;
  root.setProperty("--accent", theme[1]);
  root.setProperty("--soft", theme[2]);
  root.setProperty("--strong", theme[3]);
  $("#themeMeta").content = theme[1];
  $("#themeSwatch").style.background = theme[1];
  localStorage.setItem(THEME_KEY, String(safeIndex));
  document.querySelectorAll(".theme-chip").forEach((element, i) => element.classList.toggle("active", i === safeIndex));
}

DIFFICULTIES.forEach(item => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "difficulty";
  button.dataset.difficulty = item[0];
  button.textContent = item[1];
  button.addEventListener("click", () => {
    selectedDifficulty = item[0];
    renderHome();
  });
  $("#difficultyGrid").appendChild(button);
});

THEMES.forEach((theme, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-chip";
  button.title = theme[0];
  button.setAttribute("aria-label", `${theme[0]} 테마`);
  button.style.background = theme[1];
  button.addEventListener("click", () => applyTheme(index));
  $("#themePanel").appendChild(button);
});

for (let number = 1; number <= 9; number += 1) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = number;
  button.addEventListener("click", () => place(number));
  $("#numberPad").appendChild(button);
}

$("#themeToggle").addEventListener("click", () => {
  const panel = $("#themePanel");
  panel.classList.toggle("hidden");
  $("#themeToggle").setAttribute("aria-expanded", String(!panel.classList.contains("hidden")));
});
$("#homeButton").addEventListener("click", () => show("homeScreen"));
$("#backHome").addEventListener("click", () => {
  if (state && !state.finished) saveGame();
  show("homeScreen");
});
$("#statsBack").addEventListener("click", () => show("homeScreen"));
$("#startGame").addEventListener("click", () => startNew());
$("#continueGame").addEventListener("click", continueGame);
$("#openStats").addEventListener("click", () => show("statsScreen"));
$("#openHelp").addEventListener("click", showGuide);
$("#undo").addEventListener("click", undo);
$("#erase").addEventListener("click", () => place(0));
$("#notes").addEventListener("click", () => {
  if (!state) return;
  state.notesMode = !state.notesMode;
  renderGame();
  saveGame();
});
$("#pause").addEventListener("click", () => {
  if (!state || state.finished) return;
  state.paused = true;
  renderGame();
  saveGame();
});
$("#resumeGame").addEventListener("click", () => {
  state.paused = false;
  renderGame();
  saveGame();
});
$("#hint").addEventListener("click", useHint);
$("#resultHome").addEventListener("click", () => show("homeScreen"));
$("#resultAgain").addEventListener("click", () => {
  selectedDifficulty = state.difficulty;
  startNew(true);
});
$("#resetStats").addEventListener("click", () => confirmModal(
  "통계를 초기화할까요?",
  "누적 통계, XP, 레벨, 연승 기록을 모두 삭제합니다.",
  "초기화",
  () => {
    profile = emptyProfile();
    saveProfile();
    renderStats();
  }
));
$("#modal").addEventListener("click", event => {
  if (event.target === $("#modal")) closeModal();
});
document.addEventListener("keydown", event => {
  if (!$("#modal").classList.contains("hidden") && event.key === "Escape") closeModal();
  if (currentScreen !== "gameScreen" || !state || state.paused) return;
  if (/^[1-9]$/.test(event.key)) place(Number(event.key));
  if (event.key === "Backspace" || event.key === "Delete") place(0);
});

const storedTheme = Number(localStorage.getItem(THEME_KEY));
applyTheme(Number.isInteger(storedTheme) ? storedTheme : 0);
show("homeScreen");

setInterval(() => {
  if (currentScreen === "gameScreen" && state && !state.paused && !state.finished) {
    state.seconds += 1;
    $("#timer").textContent = formatTime(state.seconds);
    if (state.seconds % 5 === 0) saveGame();
  }
}, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
