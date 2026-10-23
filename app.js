const STORAGE_PREFIX = "sudo-game-state-v1";
const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];
const DEFAULT_SETTINGS = {
  endRule: "score",
  targetScore: 100,
  roundLimit: 10,
};

const setupPanel = document.getElementById("setupPanel");
const gamePanel = document.getElementById("gamePanel");
const scoreboard = document.getElementById("scoreboard");
const roundDisplay = document.getElementById("roundDisplay");
const timerDisplay = document.getElementById("timerDisplay");
const activePlayerLabel = document.getElementById("activePlayerLabel");
const questionText = document.getElementById("questionText");
const answerForm = document.getElementById("answerForm");
const answerInput = document.getElementById("answerInput");
const statusMessage = document.getElementById("statusMessage");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const endRuleSelect = document.getElementById("endRuleSelect");
const roundLimitField = document.getElementById("roundLimitField");
const roundLimitInput = document.getElementById("roundLimitInput");
const shareBar = document.getElementById("shareBar");
const inviteBtn = document.getElementById("inviteBtn");
const shareScoresBtn = document.getElementById("shareScoresBtn");
const shareNote = document.getElementById("shareNote");

const urlParams = new URLSearchParams(window.location.search);
const isEmbedded = window.parent !== window;

let timerId = null;
let nextRoundId = null;
let stage = "setup";
let storageKey = STORAGE_PREFIX;
let hostOrigin = null;
let state = loadState();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadState() {
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.players || parsed.players.length !== DEFAULT_NAMES.length) {
      return createDefaultState();
    }

    return {
      players: parsed.players.map((player, idx) => ({
        name: String(player?.name || DEFAULT_NAMES[idx]),
        score: Number(player?.score || 0),
      })),
      round: Number(parsed.round || 1),
      activePlayerIndex: Number(parsed.activePlayerIndex || 0),
      challenge: parsed.challenge || null,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
      },
      gameOver: Boolean(parsed.gameOver),
      winner: parsed.winner || null,
    };
  } catch (error) {
    return createDefaultState();
  }
}

function createDefaultState() {
  return {
    players: DEFAULT_NAMES.map((name) => ({ name, score: 0 })),
    round: 1,
    activePlayerIndex: 0,
    challenge: null,
    settings: { ...DEFAULT_SETTINGS },
    gameOver: false,
    winner: null,
  };
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getSelectedSettings() {
  const endRule = endRuleSelect.value;
  const roundLimit = Number(roundLimitInput.value || DEFAULT_SETTINGS.roundLimit);

  return {
    endRule,
    targetScore: 100,
    roundLimit: Math.min(50, Math.max(3, roundLimit)),
  };
}

function updateRuleVisibility() {
  const activeRule = endRuleSelect.value;
  roundLimitField.classList.toggle("hidden", activeRule !== "rounds");
}

function getPlayerNameInputs() {
  return [
    document.getElementById("player1").value.trim(),
    document.getElementById("player2").value.trim(),
    document.getElementById("player3").value.trim(),
    document.getElementById("player4").value.trim(),
  ];
}

function sanitizeName(name, fallback) {
  if (!name) {
    return fallback;
  }

  return name.substring(0, 18);
}

function renderScoreboard() {
  scoreboard.innerHTML = state.players
    .map((player, index) => {
      const isActive = index === state.activePlayerIndex && stage === "playing" && !state.gameOver;
      return `
        <article class="player-card ${isActive ? "active" : ""}">
          <div>
            <p>Player ${index + 1}</p>
            <h4>${escapeHtml(player.name)}</h4>
          </div>
          <div>
            <div class="score">${player.score}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function generateChallenge() {
  const ops = ["+", "-", "x"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let left = 3 + Math.floor(Math.random() * 12);
  let right = 2 + Math.floor(Math.random() * 12);

  if (op === "-") {
    if (left < right) {
      [left, right] = [right, left];
    }
  }

  if (op === "x") {
    left = 2 + Math.floor(Math.random() * 9);
    right = 2 + Math.floor(Math.random() * 9);
  }

  const answer =
    op === "+" ? left + right : op === "-" ? left - right : left * right;

  return {
    prompt: `${left} ${op} ${right}`,
    answer,
    operator: op,
  };
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";
  if (type) {
    statusMessage.classList.add(type);
  }
}

function startTimer() {
  clearInterval(timerId);

  let secondsLeft = 15;
  timerDisplay.textContent = `${secondsLeft}s`;

  timerId = setInterval(() => {
    secondsLeft -= 1;
    timerDisplay.textContent = `${secondsLeft}s`;

    if (secondsLeft <= 0) {
      clearInterval(timerId);
      handleTimeout();
    }
  }, 1000);
}

function moveToNextPlayer() {
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  state.round += 1;
  persistState();
}

function beginRound() {
  if (state.gameOver) {
    return;
  }

  stage = "playing";
  state.challenge = generateChallenge();
  roundDisplay.textContent = state.round;
  activePlayerLabel.textContent = state.players[state.activePlayerIndex].name;
  questionText.textContent = state.challenge.prompt;
  answerInput.value = "";
  answerInput.disabled = false;
  skipBtn.disabled = false;
  answerInput.focus();
  startTimer();
  renderScoreboard();
  persistState();
}

function getWinnerName() {
  const top = Math.max(...state.players.map((player) => player.score));
  return state.players.find((player) => player.score === top)?.name || state.players[0].name;
}

function finishGame(reason) {
  clearInterval(timerId);
  const winner = getWinnerName();
  state.gameOver = true;
  state.winner = winner;
  answerInput.disabled = true;
  skipBtn.disabled = true;
  setStatus(`${reason || "Game over!"} ${winner} wins!`, "success");
  renderScoreboard();
  persistState();
}

function handleResult(isCorrect) {
  if (state.gameOver) {
    return;
  }

  clearInterval(timerId);
  const activePlayer = state.players[state.activePlayerIndex];

  if (isCorrect) {
    const points = 10 + state.round * 2;
    activePlayer.score += points;
    setStatus(`${activePlayer.name} wins ${points} points!`, "success");
  } else {
    setStatus(`Wrong answer! The correct answer was ${state.challenge.answer}.`, "error");
  }

  renderScoreboard();

  if (state.settings.endRule === "score" && activePlayer.score >= state.settings.targetScore) {
    finishGame("Target reached!");
    return;
  }

  if (state.settings.endRule === "rounds" && state.round >= state.settings.roundLimit) {
    finishGame("Final round complete!");
    return;
  }

  persistState();
  scheduleNextRound();
}

function scheduleNextRound() {
  clearTimeout(nextRoundId);
  nextRoundId = setTimeout(() => {
    state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
    state.round += 1;
    beginRound();
  }, 1200);
}

function handleTimeout() {
  if (state.gameOver) {
    return;
  }

  setStatus(`Time's up! The answer was ${state.challenge.answer}.`, "error");
  renderScoreboard();

  if (state.settings.endRule === "score" && state.players[state.activePlayerIndex].score >= state.settings.targetScore) {
    finishGame("Target reached!");
    return;
  }

  if (state.settings.endRule === "rounds" && state.round >= state.settings.roundLimit) {
    finishGame("Final round complete!");
    return;
  }

  persistState();
  scheduleNextRound();
}

function startMatch() {
  const names = getPlayerNameInputs();
  state.players = DEFAULT_NAMES.map((fallback, index) => ({
    name: sanitizeName(names[index], fallback),
    score: 0,
  }));
  state.round = 1;
  state.activePlayerIndex = 0;
  state.gameOver = false;
  state.winner = null;
  state.settings = getSelectedSettings();
  stage = "playing";
  setStatus("Game is live.");
  setupPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  persistState();
  beginRound();
}

function resetMatch() {
  clearInterval(timerId);
  clearTimeout(nextRoundId);
  state = createDefaultState();
  state.settings = getSelectedSettings();
  setupPanel.classList.remove("hidden");
  gamePanel.classList.add("hidden");
  setStatus("Game is live.");
  persistState();
  renderScoreboard();
}

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.challenge) {
    return;
  }

  const raw = answerInput.value.trim();
  if (raw === "") {
    setStatus("Enter a valid answer.", "error");
    return;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    setStatus("Please enter a number.", "error");
    return;
  }

  handleResult(value === state.challenge.answer);
});

skipBtn.addEventListener("click", () => {
  if (!state.challenge) {
    return;
  }
  handleResult(false);
});

startBtn.addEventListener("click", startMatch);
resetBtn.addEventListener("click", resetMatch);

function initialize() {
  stage = "setup";
  setupPanel.classList.remove("hidden");
  gamePanel.classList.add("hidden");
  answerInput.disabled = false;
  skipBtn.disabled = false;
  setStatus("Game is live.");

  const savedNames = state.players.map((player, index) => player.name || DEFAULT_NAMES[index]);
  document.getElementById("player1").value = savedNames[0];
  document.getElementById("player2").value = savedNames[1];
  document.getElementById("player3").value = savedNames[2];
  document.getElementById("player4").value = savedNames[3];
  endRuleSelect.value = state.settings.endRule || DEFAULT_SETTINGS.endRule;
  roundLimitInput.value = String(state.settings.roundLimit || DEFAULT_SETTINGS.roundLimit);
  updateRuleVisibility();

  if (state.gameOver) {
    stage = "setup";
    setStatus(`Game over! ${state.winner || getWinnerName()} wins!`, "success");
    setupPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
    roundDisplay.textContent = state.round;
    activePlayerLabel.textContent = state.winner || getWinnerName();
    questionText.textContent = "Match complete";
    answerInput.disabled = true;
    skipBtn.disabled = true;
    renderScoreboard();
    return;
  }

  if (state.challenge) {
    setupPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
    stage = "playing";
    roundDisplay.textContent = state.round;
    activePlayerLabel.textContent = state.players[state.activePlayerIndex].name;
    questionText.textContent = state.challenge.prompt;
    renderScoreboard();
    startTimer();
  } else {
    renderScoreboard();
    timerDisplay.textContent = "15s";
  }
}

endRuleSelect.addEventListener("change", updateRuleVisibility);

// --- Arattai Share App integration ---

function applyHostParams() {
  document.documentElement.dataset.theme = urlParams.get("theme") === "light" ? "light" : "dark";

  const language = urlParams.get("language");
  if (language && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(language)) {
    document.documentElement.lang = language;
  }
}

function switchChat(chatId) {
  const nextKey = `${STORAGE_PREFIX}:${chatId}`;
  if (nextKey === storageKey) {
    return;
  }

  clearInterval(timerId);
  clearTimeout(nextRoundId);
  storageKey = nextKey;
  state = loadState();
  initialize();
}

function sendToHost(payload) {
  // Prefer the origin the host message came from; fall back to our own origin per the guide.
  const targetOrigin = hostOrigin || window.location.origin;

  try {
    window.parent.postMessage(
      { source: "arattai-share-app", version: 1, ...payload },
      targetOrigin
    );
    return true;
  } catch (error) {
    return false;
  }
}

function setShareNote(message) {
  shareNote.textContent = message;
}

function buildScoreText() {
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const heading = state.gameOver ? `Sudo Game - ${state.winner} wins!` : "Sudo Game - current scores";
  const lines = ranked.map((player, index) => `${index + 1}. ${player.name} - ${player.score}`);
  return [heading, ...lines].join("\n");
}

function shareScores() {
  const sent = sendToHost({ type: "message", format: "text", text: buildScoreText() });
  setShareNote(sent ? "Scores added to your chat box. Press Send there." : "Could not reach the chat.");
}

function sendInvite() {
  const inviteUrl = `${window.location.origin}${window.location.pathname}`;

  if (!inviteUrl.startsWith("https://")) {
    setShareNote("Invites need the game to be hosted on https.");
    return;
  }

  const sent = sendToHost({ type: "invite", url: inviteUrl, title: "Join my Sudo Game!" });
  setShareNote(sent ? "Invite added to your chat box. Press Send there." : "Could not reach the chat.");
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) {
    return;
  }

  const data = event.data;
  if (!data || data.source !== "arattai-host" || data.version !== 1 || data.type !== "chat_context") {
    return;
  }

  const chat = data.chat;
  if (!chat || typeof chat.id !== "string" || !/^[a-f0-9]{64}$/i.test(chat.id)) {
    return;
  }

  hostOrigin = event.origin;
  switchChat(chat.id.toLowerCase());
});

inviteBtn.addEventListener("click", sendInvite);
shareScoresBtn.addEventListener("click", shareScores);

applyHostParams();
shareBar.classList.toggle("hidden", !isEmbedded);
initialize();
