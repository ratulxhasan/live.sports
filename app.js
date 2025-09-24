// ==============================
// Global state
// ==============================
window.currentTab = "cricket";
window.matches = { cricket: [], football: [] };
let countdownTimerId = null;

// ==============================
// Tab switching
// ==============================
document.getElementById("tabFootball").addEventListener("click", () => switchTab("football"));
document.getElementById("tabCricket").addEventListener("click", () => switchTab("cricket"));

function switchTab(tab) {
  window.currentTab = tab;
  document.querySelectorAll(".matches-section").forEach(s => s.classList.add("hidden"));
  const section = document.getElementById(`${tab}-section`);
  if (section) section.classList.remove("hidden");

  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (btn) btn.classList.add("active");
}

// ==============================
// Countdown & badges
// ==============================
function formatCountdown(startISO) {
  const now = new Date();
  const start = new Date(startISO);
  let diff = Math.floor((start - now) / 1000);
  if (isNaN(start.getTime())) return "";
  if (diff <= 0) return "LIVE";

  const days = Math.floor(diff / 86400); diff %= 86400;
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return `Starts in ${days}d:${hours}h:${mins}min:${secs}sec`;
}

function getBadgeText(status, startTimeISO) {
  const s = (status || "").toLowerCase();
  if (s === "live") return "LIVE";
  if (s === "ended") return "ENDED";
  return formatCountdown(startTimeISO);
}

// ==============================
// Render matches
// ==============================
function renderMatches(sport) {
  const container = document.getElementById(`${sport}-section`);
  container.innerHTML = "";

  const list = Array.isArray(window.matches[sport]) ? window.matches[sport] : [];
  if (!list.length) {
    container.innerHTML = `<div class="no-matches"><h3>No matches</h3></div>`;
    return;
  }

  list.forEach(match => {
    const status = (match.status || "").toLowerCase();
    const badgeText = getBadgeText(match.status, match.startTime);
    const badgeClass = status === "live" ? "badge live" : status === "ended" ? "badge ended" : "badge schedule";

    const card = document.createElement("div");
    card.className = "match-card-horizontal";
    card.innerHTML = `
      <div class="match-title">${match.title || `${match.team1?.name || "Team 1"} vs ${match.team2?.name || "Team 2"}`}</div>
      <div class="match-horizontal">
        <div class="team">
          <img src="${match.team1?.logo || ""}" class="team-logo-small" alt="${match.team1?.name || "Team 1"}">
          <div class="team-name-small">${match.team1?.name || "Team 1"}</div>
        </div>

        <div class="vs-section-horizontal">
          <div class="vs-text">VS</div>
          <div class="${badgeClass}" data-status="${status}" data-start="${match.startTime || ""}">${badgeText}</div>
        </div>

        <div class="team">
          <img src="${match.team2?.logo || ""}" class="team-logo-small" alt="${match.team2?.name || "Team 2"}">
          <div class="team-name-small">${match.team2?.name || "Team 2"}</div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => loadMatch(match));
    container.appendChild(card);
  });

  ensureCountdownTicking();
}

// ==============================
// Countdown updater
// ==============================
function ensureCountdownTicking() {
  if (countdownTimerId) return;
  countdownTimerId = setInterval(() => {
    document.querySelectorAll('.badge.schedule, .badge.live').forEach(badge => {
      const status = (badge.dataset.status || "").toLowerCase();
      const start = badge.dataset.start || "";
      const text = getBadgeText(status, start);

      if (text === "LIVE" && status !== "live") {
        badge.dataset.status = "live";
        badge.classList.remove("schedule");
        badge.classList.add("live");
      }

      if (status === "ended") {
        badge.classList.remove("schedule", "live");
        badge.classList.add("ended");
      }

      badge.textContent = text;
    });
  }, 1000);
}
// ==============================
// Shaka Player setup (global)
// ==============================
shaka.polyfill.installAll();
const video = document.getElementById("video");
const wrapper = document.getElementById("player-wrapper");
const player = new shaka.Player(video);
const ui = new shaka.ui.Overlay(player, wrapper, video);

ui.configure({
  controlPanelElements: ['play_pause', 'mute', 'volume', 'fullscreen', 'quality', 'picture_in_picture'],
  addSeekBar: true
});

player.configure({
  streaming: {
    bufferingGoal: 300,
    bufferBehind: 20,
    rebufferingGoal: 10,
    jumpLargeGaps: true,
    lowLatencyMode: false,
    abr: { enabled: true }
  }
});

player.addEventListener('error', (e) => {
  console.error('❌ Error:', e.detail);
  setTimeout(() => {
    if (player.getNetworkingEngine()) {
      player.retryStreaming();
      console.log('🔁 Retrying stream…');
    }
  }, 2000);
});

// ==============================
// Player & streams
// ==============================
function loadMatch(match) {
  const videoSection = document.getElementById("videoSection");
  const videoTitle = document.getElementById("videoTitle");
  const serverRow = document.getElementById("serverRow");
  const isLive = (match.status || "").toLowerCase() === "live";

  videoSection.style.display = "block";
  videoTitle.textContent = `${match.team1?.name || "Team 1"} vs ${match.team2?.name || "Team 2"}`;

  renderStreams(match.streams || [], isLive);
}

function renderStreams(streams, isLiveMatch) {
  const row = document.getElementById("serverRow");
  row.innerHTML = "";

  const valid = streams.filter(s => s && s.url);
  valid.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.className = "server-btn";
    btn.textContent = (s.name || `Server ${i + 1}`).trim();
    btn.dataset.url = s.url;
    btn.dataset.type = s.type || "hls";
    btn.dataset.clearkey = s.clearkey ? JSON.stringify(s.clearkey) : null;

    btn.addEventListener("click", async () => {
      row.querySelectorAll(".server-btn").forEach(b => b.classList.remove("active", "live"));
      btn.classList.add("active");
      if (isLiveMatch) btn.classList.add("live");

      if (btn.dataset.type === "iframe") {
        wrapper.innerHTML =
          `<iframe src="${btn.dataset.url}" frameborder="0" allowfullscreen style="width:100%;height:100%;"></iframe>`;
      } else {
        try {
          if (btn.dataset.clearkey) {
            player.configure({ drm: { clearKeys: JSON.parse(btn.dataset.clearkey) } });
          } else {
            player.configure({ drm: { clearKeys: {} } });
          }
          await player.load(btn.dataset.url);
          video.play();
          console.log(`✅ Now playing: ${btn.textContent}`);
        } catch (err) {
          console.error("❌ Load failed:", err);
        }
      }
    });

    row.appendChild(btn);
  });

  if (row.firstChild) row.firstChild.click();
}

// ==============================
// Firebase events
// ==============================
document.addEventListener("firebaseDataReady", () => {
  window.matches.cricket = Array.isArray(window.matches.cricket) ? window.matches.cricket : [];
  window.matches.football = Array.isArray(window.matches.football) ? window.matches.football : [];

  renderMatches("football");
  renderMatches("cricket");
  switchTab("cricket"); // default
  updateFirebaseStatus("Connected");
});

document.addEventListener("firebaseDataError", () => updateFirebaseStatus("Firebase error"));

function updateFirebaseStatus(text) {
  const el = document.getElementById("firebaseStatus");
  if (!el) return;
  el.textContent = text;
  el.style.opacity = "1";
  setTimeout(() => (el.style.opacity = "0.5"), 2000);
}

// ==============================
// Menu dropdown
// ==============================
const menuBtn = document.getElementById("menuBtn");
const dropdownMenu = document.getElementById("dropdownMenu");

menuBtn.addEventListener("click", () => {
  dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", (e) => {
  if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = "none";
  }
});