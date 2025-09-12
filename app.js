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

  // Toggle sections
  document.querySelectorAll(".matches-section").forEach(s => s.classList.add("hidden"));
  document.getElementById(`${tab}-section`).classList.remove("hidden");

  // Toggle active tab button
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add("active");
}

// ==============================
// Time & badge helpers
// ==============================

// Format as "Xd:Xh:Xmin:Xsec"
// Format as "Starts in Xd:Xh:Xmin:Xsec"
function formatCountdown(startISO) {
  const now = new Date();
  const start = new Date(startISO);
  let diff = Math.floor((start - now) / 1000); // seconds

  if (isNaN(start.getTime())) return ""; // invalid date
  if (diff <= 0) return "LIVE";

  const days = Math.floor(diff / 86400); diff %= 86400;
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;

  return `Starts in ${days}d:${hours}h:${mins}min:${secs}sec`;
}

// Decide badge text based on status and start time
function getBadgeText(status, startTimeISO) {
  const s = (status || "").toLowerCase();
  if (s === "live") return "LIVE";
  if (s === "ended") return "ENDED";
  // schedule/upcoming => countdown
  return formatCountdown(startTimeISO);
}

// ==============================
// Rendering: Match lists
// ==============================
function renderMatches(sport) {
  const container = document.getElementById(`${sport}-section`);
  container.innerHTML = "";

  // ==============================
  // ✅ Sorting matches
  // ==============================
  const list = Array.isArray(window.matches[sport]) ? window.matches[sport].slice() : [];
  const order = { live: 0, upcoming: 1, ended: 2 };
  list.sort((a, b) => {
    const statusA = (a.status || "").toLowerCase();
    const statusB = (b.status || "").toLowerCase();

    if (order[statusA] !== order[statusB]) {
      return order[statusA] - order[statusB];
    }

    // Upcoming → earliest first
    if (statusA === "upcoming" && statusB === "upcoming") {
      return new Date(a.startTime) - new Date(b.startTime);
    }

    // Ended → latest first
    if (statusA === "ended" && statusB === "ended") {
      return new Date(b.startTime) - new Date(a.startTime);
    }

    return 0; // for live keep same order
  });
  // ==============================

  if (!list.length) {
    container.innerHTML = `<div class="no-matches"><h3>No matches</h3></div>`;
    return;
  }

  list.forEach(match => {
    const status = (match.status || "").toLowerCase();
    const badgeText = getBadgeText(match.status, match.startTime);
    const badgeClass =
      status === "live" ? "badge live" :
      status === "ended" ? "badge ended" : "badge schedule";

    const card = document.createElement("div");
    card.className = "match-card-horizontal";

    card.innerHTML = `
      <div class="match-title">${match.title || "Unknown Tournament"}</div>
      <div class="match-horizontal">
        <div class="team">
          <img src="${match.team1?.logo || ""}" class="team-logo-small" alt="${match.team1?.name || "Team 1"}">
          <div class="team-name-small">${match.team1?.name || "Team 1"}</div>
        </div>

        <div class="vs-section-horizontal">
          <div class="vs-text">VS</div>
          <div class="${badgeClass}"
               data-status="${status}"
               data-start="${match.startTime || ""}">
            ${badgeText}
          </div>
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
// Countdown updater (once per page)
// ==============================
function ensureCountdownTicking() {
  if (countdownTimerId) return;
  countdownTimerId = setInterval(() => {
    document.querySelectorAll('.badge.schedule, .badge.live').forEach(badge => {
      const status = (badge.dataset.status || "").toLowerCase();
      const start = badge.dataset.start || "";

      // Compute new text
      const text = getBadgeText(status, start);

      // If schedule reached LIVE, flip class to live
      if (text === "LIVE" && status !== "live") {
        badge.dataset.status = "live";
        badge.classList.remove("schedule");
        badge.classList.add("live");
      }

      // If ended, flip classes
      if (status === "ended") {
        badge.classList.remove("schedule", "live");
        badge.classList.add("ended");
      }

      badge.textContent = text;
    });
  }, 1000);
}

// ==============================
// Player & Streams
// ==============================
function loadMatch(match) {
  const videoSection = document.getElementById("videoSection");
  const videoTitle = document.getElementById("videoTitle");
  const serverRow = document.getElementById("serverRow");
  const isLive = (match.status || "").toLowerCase() === "live";

  // Reveal player section
  videoSection.style.display = "block";
  videoTitle.textContent = `${match.team1?.name || "Team 1"} vs ${match.team2?.name || "Team 2"}`;

  // Render stream buttons
  renderStreams(match.streams || [], isLive);

  // Auto-play first valid stream
  const firstBtn = serverRow.querySelector(".server-btn");
  if (firstBtn) firstBtn.click();
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

    btn.addEventListener("click", () => {
      // সব বাটন থেকে active ও live রিমুভ করো
      row.querySelectorAll(".server-btn").forEach(b => {
        b.classList.remove("active", "live");
      });

      // নতুন সিলেক্টেড বাটনে active দাও
      btn.classList.add("active");

      // যদি ম্যাচ লাইভ হয়, তাহলে live ক্লাসও দাও (blink হবে)
      if (isLiveMatch) {
        btn.classList.add("live");
      }

      // প্লে করো
      if (btn.dataset.type === "iframe") {
        document.getElementById("jwplayerDiv").innerHTML =
          `<iframe src="${btn.dataset.url}" frameborder="0" allowfullscreen style="width:100%;height:100%;"></iframe>`;
      } else {
        jwplayer("jwplayerDiv").setup({
          file: btn.dataset.url,
          type: "hls",
          width: "100%",
          aspectratio: "16:9",
          autostart: true
        });
      }
    });

    row.appendChild(btn);
  });

  // প্রথম বাটন auto-click
  if (row.firstChild) row.firstChild.click();
}

// ==============================
// Firebase data events (from your HTML module script)
// ==============================
document.addEventListener("firebaseDataReady", () => {
  try {
    // Your module script already sets window.matches = { football: [...], cricket: [...] }
    // Ensure arrays
    window.matches.cricket = Array.isArray(window.matches.cricket) ? window.matches.cricket : [];
    window.matches.football = Array.isArray(window.matches.football) ? window.matches.football : [];

    renderMatches("football");
    renderMatches("cricket");
    switchTab("cricket"); // default
    updateFirebaseStatus("Connected");
  } catch (e) {
    console.error("Error rendering matches", e);
    updateFirebaseStatus("Error");
  }
});

document.addEventListener("firebaseDataError", () => {
  updateFirebaseStatus("Firebase error");
});

// Optional small status helper
function updateFirebaseStatus(text) {
  const el = document.getElementById("firebaseStatus");
  if (!el) return;
  el.textContent = text;
  el.style.opacity = "1";
  setTimeout(() => (el.style.opacity = "0.5"), 2000);
}
const menuBtn = document.getElementById("menuBtn");
const dropdownMenu = document.getElementById("dropdownMenu");

menuBtn.addEventListener("click", () => {
  dropdownMenu.style.display =
    dropdownMenu.style.display === "block" ? "none" : "block";
});

// Optional: click outside to close
document.addEventListener("click", (e) => {
  if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = "none";
  }
});
