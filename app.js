// app.js

// Global variables with proper initialization
// NOTE: Heavily relying on global 'window' variables can lead to maintainability issues.
// Consider encapsulating these within a single state object or module pattern.
window.matches = { football: [], cricket: [] };
window.currentTab = "football";
window.selectedMatch = null;
window.selectedServer = 0;
window.isLoading = true; // Should be true initially, set to false when data is loaded/errored
window.firebaseInitialized = false; // Used by initial DOMContentLoaded check
window.pendingFirebaseData = false; // Used by initial DOMContentLoaded check

// Debug status updates
// This function is good for development. Ensure it's not present in production or is behind a flag.
function updateStatus(message) {
  const statusEl = document.getElementById('firebaseStatus');
  if (statusEl) {
    statusEl.textContent = message;
    console.log('Status:', message);
  }
}

// Show loading indicator
function showLoading(tab) {
  const section = document.getElementById(`${tab}-section`);
  section.innerHTML = `
    <div class="loading-indicator">
      <div class="spinner"></div>
      <p>Loading matches from Firebase...</p>
    </div>
  `;
}

// Helper: Parse stream for clearkey info if using old format
function parseStream(stream) {
  const parts = stream.url.split('|drmScheme=clearkey&drmLicense=');
  if (parts.length === 2) {
    const [url, drm] = parts;
    const [keyId, key] = drm.split(':');
    return { ...stream, url, keyId, key };
  }
  return stream;
}

// Enhanced render matches with better error handling
// NOTE: This function is quite large and handles multiple concerns (DOM creation, event listeners, state management, data formatting).
// Consider breaking it down into smaller, more focused functions or a component-based approach.
window.renderMatches = function(tab) {
  console.log(`Rendering matches for ${tab}:`, window.matches[tab]);
  const section = document.getElementById(`${tab}-section`);
  
  if (window.isLoading) {
    showLoading(tab);
    return;
  }
  
  section.innerHTML = ''; // Clear existing content
  
  if (!window.matches[tab] || window.matches[tab].length === 0) {
    const noMatchesDiv = document.createElement('div');
    noMatchesDiv.className = 'no-matches';
    noMatchesDiv.innerHTML = `
      <h3>No ${tab.charAt(0).toUpperCase() + tab.slice(1)} Matches</h3>
      <p>Check back later for upcoming matches.</p>
      <button class="refresh-btn" onclick="window.location.reload()">Refresh</button>
    `;
    section.appendChild(noMatchesDiv);
    updateStatus(`No ${tab} matches available`);
    return;
  }

  window.matches[tab].forEach((match, idx) => {
    const card = document.createElement('div');
    card.className = "match-card" + (window.selectedMatch && window.selectedMatch.tab === tab && window.selectedMatch.idx === idx ? " selected" : "");
    // NOTE: Direct onclick in loop creates closures. Consider event delegation on the parent for efficiency.
    card.onclick = () => selectMatch(tab, idx);
    card.setAttribute('tabindex', '0'); // Good for accessibility
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMatch(tab, idx);
      }
    });

    // Tournament name
    const tournament = document.createElement('div');
    tournament.className = "tournament-name";
    tournament.textContent = match.title;
    card.appendChild(tournament);

    // Teams row
    const info = document.createElement('div');
    info.className = "match-info";

    // Team 1
    const t1 = document.createElement('div');
    t1.className = "team";
    const t1logo = document.createElement('img');
    t1logo.className = "team-logo";
    t1logo.src = match.team1.logo;
    t1logo.alt = match.team1.name;
    t1logo.loading = "lazy"; // Good for performance
    t1logo.onerror = function() { // Good fallback for broken images
      this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNlZWUiLz4KPHN2Zz4K';
    };
    t1.appendChild(t1logo);
    const t1name = document.createElement('div');
    t1name.className = "team-name";
    t1name.textContent = match.team1.name;
    t1.appendChild(t1name);

    // VS section
    const vsSection = document.createElement('div');
    vsSection.className = "vs-section";
    const vs = document.createElement('div');
    vs.className = "vs";
    vs.textContent = "VS";
    vsSection.appendChild(vs);

    if (match.status === "live") {
      const badge = document.createElement('div');
      badge.className = "live-badge";
      badge.textContent = "LIVE";
      vsSection.appendChild(badge);
    } else if (match.status === "ended") {
      const badge = document.createElement('div');
      badge.className = "ended-badge";
      badge.textContent = match.score ? `${match.score}` : "ENDED"; // Display score if available
      vsSection.appendChild(badge);
    } else { // Scheduled match
      const badge = document.createElement('div');
      badge.className = "time-badge";
      badge.setAttribute("data-tab", tab);
      badge.setAttribute("data-idx", idx);
      badge.textContent = formatCountdown(new Date(match.startTime) - Date.now());
      vsSection.appendChild(badge);
    }

    // Team 2
    const t2 = document.createElement('div');
    t2.className = "team";
    const t2logo = document.createElement('img');
    t2logo.className = "team-logo";
    t2logo.src = match.team2.logo;
    t2logo.alt = match.team2.name;
    t2logo.loading = "lazy";
    t2logo.onerror = function() { // Good fallback for broken images
      this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNlZWUiLz4KPHN2Zz4K';
    };
    t2.appendChild(t2logo);
    const t2name = document.createElement('div');
    t2name.className = "team-name";
    t2name.textContent = match.team2.name;
    t2.appendChild(t2name);

    info.appendChild(t1);
    info.appendChild(vsSection);
    info.appendChild(t2);
    card.appendChild(info);

    section.appendChild(card);
  });
  
  updateStatus(`Showing ${window.matches[tab].length} ${tab} matches`);
}

// Format countdown as d:h:m:s or h:m:s
function formatCountdown(ms) {
  if (ms < 0) return "LIVE";
  let s = Math.floor(ms/1000);
  const d = Math.floor(s/86400); s %= 86400;
  const h = Math.floor(s/3600); s %= 3600;
  const m = Math.floor(s/60); s %= 60;
  return (d>0?d+"d ":"") + (h<10?"0":"")+h+":"+(m<10?"0":"")+m+":"+(s<10?"0":"")+s;
}

// Update countdowns every second
setInterval(() => {
  ['football','cricket'].forEach(tab=>{
    if (window.matches[tab]) {
      window.matches[tab].forEach((match, idx) => {
        if (match.status === "scheduled") {
          const badge = document.querySelector(`.time-badge[data-tab="${tab}"][data-idx="${idx}"]`);
          if (badge) {
            const diff = new Date(match.startTime) - Date.now();
            badge.textContent = formatCountdown(diff);
            if (diff <= 0) {
              match.status = "live";
              window.renderMatches(tab); // Re-render to show LIVE badge
              if (window.selectedMatch && window.selectedMatch.tab === tab && window.selectedMatch.idx === idx) {
                showVideoSection(tab, idx); // Update player if this match is selected
              }
            }
          }
        }
      });
    }
  });
}, 1000);


// Tab switching
document.getElementById('tabFootball').onclick = () => window.switchTab('football'); // Explicitly use window.switchTab
document.getElementById('tabCricket').onclick = () => window.switchTab('cricket'); // Explicitly use window.switchTab

// NOTE: switchTab is a global function. Consider encapsulating it.
window.switchTab = function(tab) {
  window.currentTab = tab;
  document.getElementById('tabFootball').classList.toggle('active', tab==='football');
  document.getElementById('tabCricket').classList.toggle('active', tab==='cricket');
  
  // Update ARIA attributes for accessibility
  document.getElementById('tabFootball').setAttribute('aria-selected', tab==='football');
  document.getElementById('tabCricket').setAttribute('aria-selected', tab==='cricket');

  document.getElementById('football-section').classList.toggle('hidden', tab!=='football');
  document.getElementById('cricket-section').classList.toggle('hidden', tab!=='cricket');
}

// Match selection
// NOTE: selectMatch also relies on and modifies global state.
function selectMatch(tab, idx) {
  window.selectedMatch = { tab, idx };
  window.selectedServer = 0; // Reset server selection on new match
  window.renderMatches(tab); // Re-render to highlight selected match
  showVideoSection(tab, idx);
}

// JW Player and iFrame integration
// NOTE: This function is complex and directly manipulates the DOM and JW Player.
// Consider breaking it into smaller functions (e.g., createServerButtons, initJwPlayer, createIframePlayer)
function showVideoSection(tab, idx) {
  const match = window.matches[tab][idx];
  if (!match || !match.streams || match.streams.length === 0) {
    console.error('Match or streams not found for tab:', tab, 'idx:', idx);
    // Optionally hide video section or show an error message in the UI
    document.getElementById('videoSection').style.display = 'none';
    return;
  }

  // Use parseStream to support both new and old formats
  const stream = parseStream(match.streams[window.selectedServer]);

  document.getElementById('videoSection').style.display = ""; // Show video section
  document.getElementById('videoTitle').textContent = match.title + ": " + match.team1.name + " vs " + match.team2.name;

  // Servers buttons
  const row = document.getElementById('serverRow');
  row.innerHTML = ""; // Clear previous buttons
  match.streams.forEach((srv, i) => {
    const btn = document.createElement('button');
    btn.className = "server-btn" + (i === window.selectedServer ? " active" : "");
    btn.textContent = srv.name;
    btn.onclick = () => {
      if (window.selectedServer !== i) { // Only update if selection changes
        window.selectedServer = i;
        showVideoSection(tab, idx); // Re-render player with new server
      }
    };
    row.appendChild(btn);
  });

  // Player rendering (JW Player or iFrame)
  const playerDiv = document.getElementById('jwplayerDiv');
  playerDiv.innerHTML = ""; // Clear previous content (important for JW Player re-init)

  if (stream.type === "iframe") {
    // Responsive iframe container
    playerDiv.innerHTML = `
      <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width:100%;">
        <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
          webkitAllowFullScreen mozallowfullscreen allowfullscreen 
          width="640" height="360" frameborder="0" allow="autoplay; fullscreen;" 
          src="${stream.url}">
        </iframe>
      </div>
    `;
  } else {
    // NOTE: window._jwSetup is set but not directly used by jwplayer.setup(). Consider removing if unused.
    window._jwSetup = stream.url; 
    const jwConfig = {
      file: stream.url,
      width: "100%",
      aspectratio: "16:9",
      autostart: true,
      controls: true,
      // Add a fallback image/poster here if available in your match data
      // poster: match.posterUrl || '' 
    };
    if (stream.keyId && stream.key) { // For ClearKey DRM
      jwConfig.drm = {
        clearkey: {
          keyId: stream.keyId,
          key: stream.key
        }
      };
    }
    // Check if jwplayer is defined before trying to setup
    if (typeof jwplayer !== 'undefined') {
      // It's generally good practice to destroy the existing player before setting up a new one
      // if (jwplayer('jwplayerDiv').getState()) {
      //   jwplayer('jwplayerDiv').remove();
      // }
      jwplayer("jwplayerDiv").setup(jwConfig);
    } else {
      console.error("JW Player is not loaded or initialized.");
      playerDiv.innerHTML = "<p>Error: Video player not available.</p>"; // User feedback
    }
  }
}

// Enhanced initialization with proper sequencing
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, waiting for Firebase...');
  updateStatus('DOM loaded, waiting for Firebase...');
  
  // Show loading state immediately for both tabs
  showLoading('football');
  showLoading('cricket');
  
  // Attach event listener for Firebase data readiness
  document.addEventListener('firebaseDataReady', () => {
    console.log('Firebase ready (via event), rendering UI...');
    updateStatus('Firebase connected, loading matches...');
    window.isLoading = false;
    window.renderMatches('football');
    window.renderMatches('cricket');
    window.switchTab('football');
    
    // Hide status after successful load
    setTimeout(() => {
      const statusEl = document.getElementById('firebaseStatus');
      if (statusEl) statusEl.style.display = 'none';
    }, 3000);
  });

  document.addEventListener('firebaseDataError', () => {
    console.log('Firebase error (via event), showing empty state');
    updateStatus('Firebase connection error - showing empty state');
    window.isLoading = false;
    window.renderMatches('football'); // Render with potential empty data
    window.renderMatches('cricket'); // Render with potential empty data
    window.switchTab('football');
    setTimeout(() => {
        const statusEl = document.getElementById('firebaseStatus');
        if (statusEl) statusEl.style.display = 'none';
      }, 5000); // Keep error message visible a bit longer
  });

  // Original polling logic (kept for compatibility with existing firebaseInitialized/pendingFirebaseData)
  // NOTE: This polling can be replaced entirely by the custom event listeners above for cleaner dependency management.
  function checkFirebaseInit() {
    if (window.firebaseInitialized || window.pendingFirebaseData) {
      // If the event listener hasn't already handled it, trigger manual render
      if (window.isLoading) { // Check if we are still in a loading state, meaning the event might not have fired yet
        console.log('Firebase ready (via poll), rendering UI...');
        updateStatus('Firebase connected, loading matches...');
        window.isLoading = false;
        window.renderMatches('football');
        window.renderMatches('cricket');
        window.switchTab('football');
        // Hide status after successful load
        setTimeout(() => {
          const statusEl = document.getElementById('firebaseStatus');
          if (statusEl) statusEl.style.display = 'none';
        }, 3000);
      }
    } else {
      console.log('Still waiting for Firebase (poll)...');
      setTimeout(checkFirebaseInit, 100);
    }
  }
  
  // Start checking after a brief delay
  setTimeout(checkFirebaseInit, 500);
  
  // Fallback timeout
  // NOTE: This timeout is useful, but consider making it shorter or more direct if Firebase fails entirely.
  setTimeout(() => {
    if (window.isLoading) { // If still loading after 10 seconds, assume a hard failure
      console.log('Firebase timeout, showing empty state');
      updateStatus('Firebase timeout - showing empty state');
      window.isLoading = false;
      window.renderMatches('football'); // Render empty state
      window.renderMatches('cricket'); // Render empty state
      window.switchTab('football');
       setTimeout(() => {
        const statusEl = document.getElementById('firebaseStatus');
        if (statusEl) statusEl.style.display = 'none';
      }, 5000); // Keep error message visible a bit longer
    }
  }, 10000); // 10 seconds
});
