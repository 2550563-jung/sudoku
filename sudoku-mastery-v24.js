(function () {
  "use strict";

  const VERSION = 26;
  const LOCK_RESET_GENERATION = 2;
  const PROFILE_KEY = "sudoku-profile-v5";
  const PROGRESSION_KEY = "sudoku-progression-v2";
  const DIFFICULTY_STATS_KEY = "sudoku-difficulty-stats-v1";
  const THEME_KEY = "sudoku-theme-v6";
  const NICKNAME_KEY = "sudoku-player-nickname-v1";
  const DIFFICULTIES = [
    ["veryEasy", "매우 쉬움", 3 * 60], ["easy", "쉬움", 4 * 60],
    ["medium", "보통", 5 * 60], ["hard", "어려움", 6 * 60],
    ["expert", "전문가", 7 * 60], ["master", "마스터", 8 * 60],
    ["extreme", "극한", 9 * 60]
  ];
  const THEMES = [
    ["코발트", "#1769ff", "#dbeafe", "#0b4ed1"], ["하늘", "#00a8f3", "#dff6ff", "#0079b7"],
    ["청록", "#00a58f", "#d3fff7", "#007363"], ["민트", "#00bd73", "#d9ffed", "#00894f"],
    ["에메랄드", "#14b83f", "#dcffe4", "#087d29"], ["라임", "#78b800", "#efffc5", "#517d00"],
    ["레몬", "#e2ae00", "#fff6bf", "#9b7200"], ["오렌지", "#ff6a00", "#ffe6d2", "#c54100"],
    ["코랄", "#f33f32", "#ffe1de", "#bd2118"], ["핑크", "#f02f88", "#ffe0f0", "#bd1762"],
    ["바이올렛", "#8d4aff", "#eee4ff", "#6123c5"], ["인디고", "#5146e5", "#e6e6ff", "#352bb0"],
    ["살구", "#f58b61", "#fff0e7", "#b95636"], ["라벤더", "#a77be8", "#f1e9ff", "#7650af"],
    ["아쿠아", "#00bfd1", "#d9fbff", "#007d8b"], ["올리브", "#83a52d", "#f1f7d9", "#58701d"],
    ["로즈", "#d83f63", "#ffe4ea", "#a32443"], ["앰버", "#e58a00", "#fff0ce", "#a45e00"],
    ["초콜릿", "#a45a2a", "#f8e8dc", "#713718"], ["슬레이트", "#5b708c", "#e5edf5", "#35475e"],
    ["오닉스", "#172033", "#e1e6ee", "#050912"]
  ];

  const $ = (selector) => document.querySelector(selector);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const defaultProgression = () => ({ version: VERSION, resetGeneration: LOCK_RESET_GENERATION, unlockedIndex: 0, extremeTestUnlocked: false, master: false, lastResult: "" });
  const storedProgression = read(PROGRESSION_KEY, null);
  const progression = Object.assign(
    defaultProgression(),
    storedProgression?.resetGeneration === LOCK_RESET_GENERATION ? storedProgression : {}
  );
  let difficultyStats = read(DIFFICULTY_STATS_KEY, {});
  let selectedTheme = Math.max(0, Number(localStorage.getItem(THEME_KEY)) || 0);
  let accountClient = null;
  let accountUser = null;
  let syncTimer = 0;

  function saveProgression() { write(PROGRESSION_KEY, progression); }
  function unlockedThemeCount() { return 12 + Math.floor(Math.max(0, progression.unlockedIndex) * 9 / 6); }
  function isThemeUnlocked(index) { return index < Math.min(21, unlockedThemeCount()); }
  function applyTheme(index) {
    const isGold = index === 21 && progression.master;
    if ((!isGold && !isThemeUnlocked(index)) || (!THEMES[index] && !isGold)) return;
    const theme = isGold ? ["고결한 금빛", "#d8a413", "#fff4bf", "#8a5c00"] : THEMES[index];
    document.documentElement.style.setProperty("--accent", theme[1]);
    document.documentElement.style.setProperty("--soft", theme[2]);
    document.documentElement.style.setProperty("--strong", theme[3]);
    $("#themeMeta").content = theme[1];
    $("#themeSwatch").style.background = theme[1];
    selectedTheme = index;
    localStorage.setItem(THEME_KEY, String(index));
    document.querySelectorAll(".theme-chip").forEach((chip) => chip.classList.toggle("active", Number(chip.dataset.masteryTheme) === index));
  }

  function renderThemes() {
    const panel = $("#themePanel");
    if (!panel) return;
    panel.innerHTML = "";
    const all = progression.master ? [...THEMES, ["고결한 금빛"]] : THEMES;
    all.forEach((theme, index) => {
      const button = document.createElement("button");
      const unlocked = index === 21 ? progression.master : isThemeUnlocked(index);
      button.type = "button";
      button.className = `theme-chip${unlocked ? "" : " locked"}${index === 21 ? " master-gold" : ""}`;
      button.dataset.masteryTheme = String(index);
      button.title = unlocked ? theme[0] : `${theme[0]} · 난이도를 해금하면 사용할 수 있습니다`;
      button.setAttribute("aria-label", button.title);
      if (index < 21) button.style.background = theme[1];
      button.addEventListener("click", () => unlocked ? applyTheme(index) : showNotice("잠긴 색상", "앞 난이도를 제한 시간 안에 완료하면 새 색상이 열립니다."));
      panel.appendChild(button);
    });
    if ((selectedTheme === 21 && !progression.master) || (selectedTheme < 21 && !isThemeUnlocked(selectedTheme))) selectedTheme = 0;
    applyTheme(selectedTheme);
  }

  function showNotice(title, message) {
    const modal = $("#modal");
    if (!modal) return alert(message);
    $("#modalTitle").textContent = title;
    $("#modalText").textContent = message;
    const actions = $("#modalActions");
    actions.innerHTML = "";
    const button = document.createElement("button");
    button.className = "primary"; button.textContent = "확인";
    button.onclick = () => modal.classList.add("hidden");
    actions.appendChild(button); modal.classList.remove("hidden");
  }

  function renderLocks() {
    document.querySelectorAll(".difficulty").forEach((button) => {
      const index = DIFFICULTIES.findIndex((item) => item[0] === button.dataset.difficulty);
      const locked = index > progression.unlockedIndex;
      button.classList.toggle("locked", locked);
      button.classList.toggle("unlock-ready", index === progression.unlockedIndex);
      button.setAttribute("aria-disabled", String(locked));
      button.title = locked ? `${DIFFICULTIES[index - 1][1]}을 ${formatTime(DIFFICULTIES[index - 1][2])} 안에 완료해야 합니다.` : "";
    });
    renderMasteryCard();
  }

  function formatTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function parseResultSeconds() {
    const match = $("#resultGrid")?.textContent.match(/완료 시간\s*(\d{2,}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  }

  function processResult() {
    const result = $("#resultScreen");
    if (!result || result.hidden || $("#resultEyebrow")?.textContent.trim() !== "CLEAR") return;
    const difficultyText = $("#difficultyLabel")?.textContent || "";
    const index = DIFFICULTIES.findIndex((item) => difficultyText.startsWith(item[1]));
    const seconds = parseResultSeconds();
    if (index < 0 || !seconds) return;
    const profile = read(PROFILE_KEY, {});
    const signature = `${index}:${seconds}:${Number(profile.played) || 0}`;
    if (progression.lastResult === signature) return;
    progression.lastResult = signature;
    const key = DIFFICULTIES[index][0];
    const saved = difficultyStats[key] || { wins: 0, totalSeconds: 0, bestSeconds: 0 };
    saved.wins += 1; saved.totalSeconds += seconds;
    saved.bestSeconds = saved.bestSeconds ? Math.min(saved.bestSeconds, seconds) : seconds;
    difficultyStats[key] = saved; write(DIFFICULTY_STATS_KEY, difficultyStats);
    let message = "기록이 저장되었습니다.";
    if (index === progression.unlockedIndex && seconds <= DIFFICULTIES[index][2]) {
      if (index < DIFFICULTIES.length - 1) {
        progression.unlockedIndex += 1;
        message = `${DIFFICULTIES[index + 1][1]} 난이도와 새 색상이 해금되었습니다!`;
      } else {
        progression.extremeTestUnlocked = true;
        message = "스도쿠 테스트가 해금되었습니다!";
      }
    }
    saveProgression(); renderLocks(); renderThemes(); queueAccountSync();
    $("#resultSubtitle").textContent += ` ${message}`;
  }

  function ensureMasteryCard() {
    if ($("#masteryCard")) return;
    const section = document.createElement("section");
    section.id = "masteryCard"; section.className = "card mastery-card";
    const statsButton = $("#openStats")?.parentElement || $("#homeScreen");
    statsButton?.insertAdjacentElement("afterend", section);
  }

  function renderMasteryCard() {
    ensureMasteryCard();
    const card = $("#masteryCard"); if (!card) return;
    const rows = DIFFICULTIES.map((item, index) => {
      const stat = difficultyStats[item[0]];
      const average = stat?.wins ? formatTime(Math.round(stat.totalSeconds / stat.wins)) : "기록 없음";
      const status = index <= progression.unlockedIndex ? (index === progression.unlockedIndex && index < 6 ? `도전 · ${formatTime(item[2])}` : "해금") : "잠김";
      return `<div class="mastery-progress-row"><span>${item[1]} · 평균 ${average}</span><strong>${status}</strong></div>`;
    }).join("");
    card.innerHTML = `<h3>난이도 도전 · 평균 시간</h3><p>각 난이도를 제한 시간 안에 완료하면 다음 난이도와 색상이 열립니다.</p><div class="mastery-progress">${rows}</div><button id="openSudokuTest" class="primary wide" type="button" ${progression.extremeTestUnlocked && !progression.master ? "" : "disabled"}>${progression.master ? "스도쿠의 달인 인증 완료" : progression.extremeTestUnlocked ? "스도쿠 테스트 시작" : "극한을 제한 시간 안에 완료하면 테스트 해금"}</button>${progression.master ? '<button id="openCertificate" class="secondary wide" type="button">스도쿠 자격증 열기</button>' : ""}`;
    $("#openSudokuTest")?.addEventListener("click", openSudokuTest);
    $("#openCertificate")?.addEventListener("click", openCertificate);
  }

  function makeOverlay(id, content) {
    document.getElementById(id)?.remove();
    const overlay = document.createElement("div"); overlay.id = id; overlay.className = "mastery-overlay";
    overlay.innerHTML = `<div class="mastery-dialog">${content}</div>`; document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    return overlay;
  }

  function shuffledNumbers() { return [...Array(9)].map((_, i) => i + 1).sort(() => Math.random() - .5); }
  function openSudokuTest() {
    if (!progression.extremeTestUnlocked || progression.master) return;
    const overlay = makeOverlay("sudokuTestOverlay", '<h2>스도쿠 테스트</h2><p id="testStatus">90초 안에 10문제 중 9문제 이상 맞히세요.</p><div id="testQuestion"></div><button id="testClose" class="secondary wide" type="button">나가기</button>');
    let question = 0, correct = 0, finished = false; const started = Date.now();
    const render = () => {
      if (finished) return;
      const remaining = 90 - Math.floor((Date.now() - started) / 1000);
      if (remaining <= 0 || question >= 10) return finishTest(correct >= 9 && remaining > 0);
      const row = shuffledNumbers(), blank = Math.floor(Math.random() * 9), answer = row[blank]; row[blank] = 0;
      $("#testStatus").textContent = `${question + 1}/10 · 정답 ${correct} · 남은 시간 ${remaining}초`;
      $("#testQuestion").innerHTML = `<p>이 행의 빈칸에 들어갈 숫자는?</p><div class="test-row">${row.map((n) => `<span class="test-cell${n ? "" : " blank"}">${n || "?"}</span>`).join("")}</div><div class="test-answers">${[...Array(9)].map((_, i) => `<button type="button" data-answer="${i + 1}">${i + 1}</button>`).join("")}</div>`;
      document.querySelectorAll("[data-answer]").forEach((button) => button.onclick = () => { if (Number(button.dataset.answer) === answer) correct += 1; question += 1; render(); });
    };
    const finishTest = (passed) => {
      finished = true; clearInterval(timer);
      if (passed) {
        progression.master = true; saveProgression(); renderThemes(); renderLocks(); queueAccountSync();
        $("#testQuestion").innerHTML = '<h3>합격 — 스도쿠의 달인</h3><p>반짝이는 고결한 금색과 자격증이 해금되었습니다.</p><button id="testCertificate" class="primary wide" type="button">자격증 만들기</button>';
        $("#testCertificate").onclick = () => { overlay.remove(); openCertificate(); };
      } else $("#testQuestion").innerHTML = `<h3>아쉽게 불합격</h3><p>${correct}/10 정답입니다. 다시 도전할 수 있습니다.</p>`;
    };
    const timer = setInterval(() => { if (Date.now() - started >= 90000) finishTest(false); else if (!finished) $("#testStatus").textContent = `${question + 1}/10 · 정답 ${correct} · 남은 시간 ${90 - Math.floor((Date.now() - started) / 1000)}초`; }, 1000);
    $("#testClose").onclick = () => { clearInterval(timer); overlay.remove(); }; render();
  }

  function accountName() { return accountUser?.user_metadata?.username || accountUser?.email?.split("@")[0] || ""; }
  function certificateName() { return localStorage.getItem(NICKNAME_KEY)?.trim() || accountName() || "스도쿠 플레이어"; }
  function drawCertificate(canvas, signature) {
    canvas.width = 1200; canvas.height = 850; const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1200, 850); gradient.addColorStop(0, "#fffdf5"); gradient.addColorStop(1, "#fff4c7"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 850);
    ctx.strokeStyle = "#b98512"; ctx.lineWidth = 14; ctx.strokeRect(30, 30, 1140, 790); ctx.lineWidth = 2; ctx.strokeRect(52, 52, 1096, 746);
    ctx.textAlign = "center"; ctx.fillStyle = "#8a5c00"; ctx.font = "700 30px sans-serif"; ctx.fillText("SUDOKU MASTERY CERTIFICATE", 600, 150);
    ctx.fillStyle = "#172033"; ctx.font = "900 68px sans-serif"; ctx.fillText("스도쿠의 달인 자격증", 600, 250);
    ctx.font = "800 52px sans-serif"; ctx.fillStyle = "#9a6908"; ctx.fillText(certificateName(), 600, 380);
    ctx.font = "28px sans-serif"; ctx.fillStyle = "#334155"; ctx.fillText("위 사람은 모든 난이도를 해금하고 스도쿠 테스트를 통과했기에", 600, 465); ctx.fillText("스도쿠의 달인임을 인증합니다.", 600, 510);
    ctx.font = "22px sans-serif"; ctx.fillText(new Date().toLocaleDateString("ko-KR"), 600, 625);
    ctx.fillStyle = "#d8a413"; ctx.beginPath(); ctx.arc(935, 655, 74, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff8d0"; ctx.font = "900 25px sans-serif"; ctx.fillText("MASTER", 935, 665);
    if (signature) { ctx.drawImage(signature, 390, 650, 420, 98); ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(390, 755); ctx.lineTo(810, 755); ctx.stroke(); ctx.font = "18px sans-serif"; ctx.fillStyle = "#64748b"; ctx.fillText("서명", 600, 785); }
  }

  function openCertificate() {
    if (!progression.master) return;
    const overlay = makeOverlay("certificateOverlay", '<h2>스도쿠의 달인 자격증</h2><canvas id="certificatePreview" class="certificate-preview"></canvas><p>아래 칸에 손글씨로 서명하면 다운로드 버튼이 활성화됩니다.</p><canvas id="signaturePad" class="signature-pad" width="600" height="140"></canvas><div class="certificate-actions"><button id="clearSignature" class="secondary" type="button">서명 지우기</button><button id="downloadCertificate" class="primary" type="button" disabled>PNG 다운로드</button></div><button id="closeCertificate" class="secondary wide" type="button">닫기</button>');
    const preview = $("#certificatePreview"), pad = $("#signaturePad"), ctx = pad.getContext("2d"); drawCertificate(preview); ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.strokeStyle = "#172033"; let drawing = false, signed = false;
    const point = (event) => { const rect = pad.getBoundingClientRect(); return [(event.clientX - rect.left) * pad.width / rect.width, (event.clientY - rect.top) * pad.height / rect.height]; };
    pad.onpointerdown = (event) => { drawing = true; pad.setPointerCapture(event.pointerId); const [x, y] = point(event); ctx.beginPath(); ctx.moveTo(x, y); };
    pad.onpointermove = (event) => { if (!drawing) return; const [x, y] = point(event); ctx.lineTo(x, y); ctx.stroke(); signed = true; $("#downloadCertificate").disabled = false; };
    pad.onpointerup = () => { drawing = false; };
    $("#clearSignature").onclick = () => { ctx.clearRect(0, 0, pad.width, pad.height); signed = false; $("#downloadCertificate").disabled = true; };
    $("#downloadCertificate").onclick = () => { if (!signed) return; drawCertificate(preview, pad); const link = document.createElement("a"); link.download = `스도쿠-달인-자격증-${certificateName()}.png`; link.href = preview.toDataURL("image/png"); link.click(); };
    $("#closeCertificate").onclick = () => overlay.remove();
  }

  function ensureAccountCard() {
    if ($("#sudokuAccountCard")) return;
    const card = document.createElement("section"); card.id = "sudokuAccountCard"; card.className = "card mastery-card sudoku-account-card";
    card.innerHTML = '<div class="account-card-heading"><span class="account-avatar" aria-hidden="true">👤</span><div><small>ACCOUNT</small><h3>계정 저장</h3></div><span id="accountStateBadge" class="account-state-badge">로그아웃</span></div><p>이메일 인증 없이 아이디와 비밀번호만으로 로그인합니다. 이 기기의 닉네임과 기록은 계정 없이도 유지됩니다.</p><label class="field"><span>아이디</span><input id="accountUsername" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" placeholder="영문·숫자·_ 4~20자"></label><label class="field"><span>비밀번호</span><input id="accountPassword" type="password" minlength="6" autocomplete="current-password" placeholder="6자 이상"></label><div class="account-actions"><button id="accountLogin" class="primary" type="button">로그인</button><button id="accountSignup" class="secondary" type="button">새 계정 만들기</button><button id="accountLogout" class="secondary wide hidden" type="button">로그아웃</button></div><p id="accountStatus" class="account-status" aria-live="polite">로그인하지 않음 · 이 기기에 저장 중</p>';
    const homeHero = $("#homeScreen .hero");
    if (homeHero) homeHero.insertAdjacentElement("afterend", card); else $("#homeScreen")?.prepend(card);
    $("#accountLogin").onclick = () => accountAction("login"); $("#accountSignup").onclick = () => accountAction("signup"); $("#accountLogout").onclick = accountLogout;
    $("#accountIndicator")?.addEventListener("click", () => { card.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => $("#accountUsername")?.focus(), 350); });
  }

  function accountStatus(message, error) { const node = $("#accountStatus"); if (node) { node.textContent = message; node.style.color = error ? "var(--danger)" : ""; } }
  function usernameEmail(username) { return `${username.trim().toLowerCase()}@id.sudoku.local`; }
  async function accountAction(type) {
    const username = $("#accountUsername").value.trim(), password = $("#accountPassword").value;
    const legacyEmail = username.includes("@");
    if ((!legacyEmail && !/^[A-Za-z0-9_]{4,20}$/.test(username)) || password.length < 6) return accountStatus("아이디는 영문·숫자·_ 4~20자, 비밀번호는 6자 이상이어야 합니다.", true);
    accountStatus("처리 중…");
    if (type === "signup" && legacyEmail) return accountStatus("새 계정은 이메일이 아닌 아이디를 입력해 주세요.", true);
    const email = legacyEmail ? username : usernameEmail(username);
    const response = type === "signup"
      ? await accountClient.auth.signUp({ email, password, options: { data: { username } } })
      : await accountClient.auth.signInWithPassword({ email, password });
    if (response.error) return accountStatus(response.error.message, true);
    if (type === "signup" && !response.data.session) return accountStatus("계정 인증 설정을 적용하는 중입니다. 잠시 후 다시 시도해 주세요.", true);
    accountStatus(type === "signup" ? "계정이 만들어졌고 바로 로그인되었습니다." : "로그인되었습니다.");
  }
  async function accountLogout() { await accountClient.auth.signOut(); accountStatus("로그아웃했습니다."); }

  function mergeNumbers(local, remote) {
    const result = { ...(remote || {}), ...(local || {}) };
    for (const key of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) if (typeof local?.[key] === "number" || typeof remote?.[key] === "number") result[key] = Math.max(Number(local?.[key]) || 0, Number(remote?.[key]) || 0);
    return result;
  }
  function mergeDifficultyStats(local, remote) {
    const merged = {};
    for (const key of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
      const a = local?.[key] || {}, b = remote?.[key] || {};
      merged[key] = { wins: Math.max(a.wins || 0, b.wins || 0), totalSeconds: Math.max(a.totalSeconds || 0, b.totalSeconds || 0), bestSeconds: a.bestSeconds && b.bestSeconds ? Math.min(a.bestSeconds, b.bestSeconds) : (a.bestSeconds || b.bestSeconds || 0) };
    }
    return merged;
  }
  async function loadAccountData() {
    if (!accountUser) return;
    const { data, error } = await accountClient.from("sudoku_account_profiles").select("profile,progression,difficulty_stats").eq("user_id", accountUser.id).maybeSingle();
    if (error) return accountStatus("계정 기록을 불러오지 못했습니다.", true);
    if (data) {
      write(PROFILE_KEY, mergeNumbers(read(PROFILE_KEY, {}), data.profile));
      const remoteProgression = data.progression || {};
      const remoteUsesCurrentLocks = remoteProgression.resetGeneration === LOCK_RESET_GENERATION
        && Number(remoteProgression.version) >= 25;
      if (remoteUsesCurrentLocks) {
        Object.assign(progression, mergeNumbers(progression, remoteProgression), {
          extremeTestUnlocked: Boolean(progression.extremeTestUnlocked || remoteProgression.extremeTestUnlocked),
          master: Boolean(progression.master || remoteProgression.master)
        });
      }
      progression.version = VERSION;
      progression.resetGeneration = LOCK_RESET_GENERATION;
      saveProgression();
      difficultyStats = mergeDifficultyStats(difficultyStats, data.difficulty_stats); write(DIFFICULTY_STATS_KEY, difficultyStats);
      renderLocks(); renderThemes();
    }
    await syncAccountData();
  }
  async function syncAccountData() {
    if (!accountUser) return;
    const payload = { user_id: accountUser.id, profile: read(PROFILE_KEY, {}), progression, difficulty_stats: difficultyStats, updated_at: new Date().toISOString() };
    const { error } = await accountClient.from("sudoku_account_profiles").upsert(payload, { onConflict: "user_id" });
    accountStatus(error ? "동기화에 실패했습니다. 이 기기의 기록은 안전하게 유지됩니다." : `${accountName()} · 동기화됨`, Boolean(error));
  }
  function queueAccountSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncAccountData, 1200); }
  function renderAccount() {
    const loggedIn = Boolean(accountUser); $("#accountLogin")?.classList.toggle("hidden", loggedIn); $("#accountSignup")?.classList.toggle("hidden", loggedIn); $("#accountLogout")?.classList.toggle("hidden", !loggedIn);
    const indicator = $("#accountIndicatorText"), badge = $("#accountStateBadge");
    if (indicator) indicator.textContent = loggedIn ? (accountName() || "로그인됨") : "계정 로그인";
    if (badge) { badge.textContent = loggedIn ? "로그인됨" : "로그아웃"; badge.classList.toggle("online", loggedIn); }
    if (loggedIn) { $("#accountUsername").value = accountName(); $("#accountUsername").disabled = true; $("#accountPassword").parentElement.classList.add("hidden"); } else { $("#accountUsername").disabled = false; $("#accountPassword").parentElement.classList.remove("hidden"); accountStatus("로그인하지 않았습니다."); }
  }

  function initAccount() {
    ensureAccountCard();
    renderAccount();
    if (!window.supabase?.createClient) return accountStatus("계정 모듈을 불러오지 못했습니다.", true);
    accountClient = window.supabase.createClient("https://wxaufxqcanqsksntllsw.supabase.co", "sb_publishable_SMn528g1hfMZAEWHCmOVRA_NUbtUFzE", { auth: { storageKey: "sudoku-account-auth-v1", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, realtime: false });
    accountClient.auth.onAuthStateChange((_event, session) => { const changed = accountUser?.id !== session?.user?.id; accountUser = session?.user || null; renderAccount(); if (accountUser && changed) setTimeout(loadAccountData, 0); });
    setInterval(queueAccountSync, 15000);
  }

  function init() {
    saveProgression();
    const first = document.querySelector('.difficulty[data-difficulty="veryEasy"]');
    if (progression.unlockedIndex === 0 && !document.querySelector(".difficulty.active")?.matches('[data-difficulty="veryEasy"]')) first?.click();
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.(".difficulty"); if (!button) return;
      const index = DIFFICULTIES.findIndex((item) => item[0] === button.dataset.difficulty);
      if (index > progression.unlockedIndex) { event.preventDefault(); event.stopImmediatePropagation(); showNotice("잠긴 난이도", `${DIFFICULTIES[index - 1][1]}을 ${formatTime(DIFFICULTIES[index - 1][2])} 안에 완료해야 합니다.`); }
    }, true);
    $("#startGame")?.addEventListener("click", (event) => { const active = document.querySelector(".difficulty.active"), index = DIFFICULTIES.findIndex((item) => item[0] === active?.dataset.difficulty); if (index > progression.unlockedIndex) { event.preventDefault(); event.stopImmediatePropagation(); showNotice("잠긴 난이도", "앞 난이도를 먼저 해금해 주세요."); } }, true);
    const observer = new MutationObserver(() => processResult()); observer.observe($("#resultScreen"), { attributes: true, attributeFilter: ["class", "hidden"] });
    renderThemes(); renderLocks(); initAccount(); processResult();
    const publicApi = { VERSION, progression, difficultyStats, renderThemes, renderLocks };
    window.SudokuMasteryV26 = publicApi;
    window.SudokuMasteryV25 = publicApi;
    window.SudokuMasteryV24 = publicApi;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
