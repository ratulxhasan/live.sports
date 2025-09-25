// ==============================
// Ratul LIV - Fixed Extra Enhanced App.js
// ==============================
shaka.polyfill.installAll();

let player, video, wrapper;
let countdownTimerId = null;

// ==============================
// Network detection for ABR
// ==============================
async function getNetworkSpeed() {
  try {
    const start = performance.now();
    const response = await fetch('https://www.google.com/images/branding/googlelogo/2x/googlelogo_light_color_92x30dp.png', {cache:'no-cache'});
    const blob = await response.blob();
    const duration = (performance.now() - start) / 1000;
    const bitsLoaded = blob.size * 8;
    return bitsLoaded; // bits/sec
  } catch {
    return 2_000_000; // default 2 Mbps
  }
}

// ==============================
// Initialize Shaka Player
// ==============================
async function initPlayer() {
  video = document.getElementById("video");
  wrapper = document.getElementById("player-wrapper");
  player = new shaka.Player(video);

  const ui = new shaka.ui.Overlay(player, wrapper, video);
  ui.configure({
    controlPanelElements: ['play_pause','mute','volume','fullscreen','quality','picture_in_picture'],
    addSeekBar: true
  });

  const netSpeed = await getNetworkSpeed();
  const maxBandwidth = Math.max(Math.min(netSpeed * 0.75, 5_000_000), 500_000);

  player.configure({
    drm: { retryParameters: { maxAttempts: 10, baseDelay: 1000, backoffFactor: 2 } },
    streaming: { bufferingGoal:60, rebufferingGoal:5, bufferBehind:30, skipLargeGaps:true, lowLatencyMode:false },
    abr: { enabled:true, switchInterval:8, defaultBandwidthEstimate:netSpeed, bandwidthUpgradeTarget:0.7, bandwidthDowngradeTarget:0.9,
      restrictions:{ minBandwidth:300_000, maxBandwidth:maxBandwidth, minWidth:0, maxWidth:1280, minHeight:0, maxHeight:720 } },
    manifest: { retryParameters:{ maxAttempts:10, baseDelay:1000, backoffFactor:2 } }
  });

  player.addEventListener('error', async e => {
    const shakaError = e.detail;
    console.error("🔴 Stream/DRM Error:", shakaError?.category, shakaError?.code, shakaError?.data || "");
    if(shakaError?.category === 4 && shakaError?.code === 4038) {
      console.log("🔁 DRM license retry...");
      setTimeout(async () => {
        try {
          const currentUrl = video.src || "";
          if(currentUrl && player.getNetworkingEngine()) {
            await player.load(currentUrl);
            video.play();
            console.log("✅ DRM retry success!");
          }
        } catch(err) { console.error("❌ DRM retry failed:", err); }
      }, 2000);
    }
  });
}

// ==============================
// Firebase fetch & localStorage cache
// ==============================
async function loadMatchesFresh() {
  try {
    const db = firebase.database();
    const matchesRef = db.ref('matches');

    const snapshot = await matchesRef.once('value');
    const data = snapshot.val() || {};
    const matches = {
      football: data.football ? Object.values(data.football) : [],
      cricket: data.cricket ? Object.values(data.cricket) : []
    };

    // Save fresh data to localStorage
    localStorage.setItem('matchesCache', JSON.stringify({ matches, updated: Date.now() }));

    window.matches = matches;
    document.dispatchEvent(new CustomEvent('firebaseDataReady'));
  } catch (err) {
    console.error("❌ Firebase load error:", err);
    document.dispatchEvent(new CustomEvent('firebaseDataError'));
  }
}

function clearMatchesCache() { localStorage.removeItem('matchesCache'); }

// ==============================
// Render match cards
// ==============================
function formatCountdown(startISO) {
  const now = new Date();
  const start = new Date(startISO);
  let diff = Math.floor((start - now)/1000);
  if(isNaN(start.getTime())) return "";
  if(diff<=0) return "LIVE";
  const days = Math.floor(diff/86400); diff%=86400;
  const hours = Math.floor(diff/3600); diff%=3600;
  const mins = Math.floor(diff/60);
  const secs = diff%60;
  return `Starts in ${days}d:${hours}h:${mins}m:${secs}s`;
}

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
    const badgeText = status==='live'?'LIVE':status==='ended'?'ENDED':formatCountdown(match.startTime);
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

    // ✅ Only on click, load player
    card.addEventListener("click", () => loadMatch(match));
    container.appendChild(card);
  });
}

// ==============================
// Load selected match in player
// ==============================
async function loadMatch(match) {
  const videoSection = document.getElementById("videoSection");
  const videoTitle = document.getElementById("videoTitle");
  const serverRow = document.getElementById("serverRow");
  const isLive = (match.status || "").toLowerCase() === "live";

  videoSection.style.display = "block";
  videoTitle.textContent = `${match.team1?.name || "Team 1"} vs ${match.team2?.name || "Team 2"}`;
  serverRow.innerHTML = "";

  const validStreams = (match.streams || []).filter(s => s && s.url);
  localStorage.setItem('lastStreams', JSON.stringify({ streams: validStreams, updated: Date.now() }));

  validStreams.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.className = "server-btn";
    btn.textContent = (s.name || `Server ${i+1}`).trim();
    btn.dataset.url = s.url;
    btn.dataset.clearkey = s.clearkey ? JSON.stringify(s.clearkey) : null;
    btn.dataset.type = s.type || "dash";

    btn.addEventListener("click", async () => {
      serverRow.querySelectorAll(".server-btn").forEach(b => b.classList.remove("active","live"));
      btn.classList.add("active");
      if(isLive) btn.classList.add("live");

      if(btn.dataset.type === "iframe") {
        wrapper.innerHTML = `<iframe src="${btn.dataset.url}" frameborder="0" allowfullscreen style="width:100%;height:100%;"></iframe>`;
      } else {
        try {
          if(btn.dataset.clearkey) player.configure({ drm:{ clearKeys: JSON.parse(btn.dataset.clearkey) } });
          await player.load(btn.dataset.url);
          video.play();
          console.log(`✅ Playing: ${btn.textContent}`);
        } catch(err) { console.error("❌ Load failed:", err); }
      }
    });

    serverRow.appendChild(btn);
  });

  if(serverRow.firstChild) serverRow.firstChild.click();
}

// ==============================
// Firebase events
// ==============================
document.addEventListener("firebaseDataReady", async () => {
  await initPlayer();
  renderMatches("football");
  renderMatches("cricket");
  switchTab("cricket"); // default tab
});

document.addEventListener("firebaseDataError", () => console.error("❌ Firebase failed"));

// ==============================
// Tabs
// ==============================
function switchTab(tab) {
  document.querySelectorAll(".matches-section").forEach(s => s.classList.add("hidden"));
  const section = document.getElementById(`${tab}-section`);
  if(section) section.classList.remove("hidden");

  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`);
  if(btn) btn.classList.add("active");
  window.currentTab = tab;
}

document.getElementById("tabFootball").addEventListener("click", () => switchTab("football"));
document.getElementById("tabCricket").addEventListener("click", () => switchTab("cricket"));

// ==============================
// Load fresh data on page load
// ==============================
window.addEventListener('load', () => loadMatchesFresh());
