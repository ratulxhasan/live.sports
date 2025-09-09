// Initialize tracking object
let userSession = {
  visitedPages: [],
  clickedElements: [],
  formInputs: {},
  timestamp: new Date().toISOString()
};

// 🧭 Track page visits
userSession.visitedPages.push(window.location.pathname);

// 🖱️ Track clicks
document.addEventListener("click", (e) => {
  const target = e.target;
  if (target.id || target.className) {
    userSession.clickedElements.push({
      id: target.id || null,
      class: target.className || null,
      tag: target.tagName,
      time: new Date().toISOString()
    });
    localStorage.setItem("userSession", JSON.stringify(userSession));
  }
});

// 📝 Track form input
document.querySelectorAll("input, textarea, select").forEach((el) => {
  el.addEventListener("change", () => {
    userSession.formInputs[el.name || el.id] = el.value;
    localStorage.setItem("userSession", JSON.stringify(userSession));
  });
});

// 💾 Save on unload
window.addEventListener("beforeunload", () => {
  localStorage.setItem("userSession", JSON.stringify(userSession));
});// Load session data
const savedSession = JSON.parse(localStorage.getItem("userSession"));

if (savedSession) {
  console.log("Previous session:", savedSession);

  // Example: Restore form inputs
  Object.entries(savedSession.formInputs).forEach(([key, value]) => {
    const el = document.querySelector(`[name='${key}'], #${key}`);
    if (el) el.value = value;
  });

  // Example: Highlight previously clicked elements
  savedSession.clickedElements.forEach(({ id }) => {
    if (id) {
      const el = document.getElementById(id);
      if (el) el.style.border = "2px solid gold";
    }
  });
}
const userPrefs = {
  stream: localStorage.getItem("lastStream"),
  theme: localStorage.getItem("theme"),
  lang: localStorage.getItem("lang")
};

// Use these to customize Firebase queries or UI rendering
firebase.database().ref(`/streams/${userPrefs.stream}`).once("value").then((snapshot) => {
  renderStream(snapshot.val());
});
function restoreUserSession() {
  const userData = JSON.parse(localStorage.getItem("userSession")) || {};
  // Apply UI state before Firebase loads
  if (userData.theme) document.body.className = userData.theme;
  if (userData.lastStream) loadStream(userData.lastStream);
  if (userData.selectedTab) activateTab(userData.selectedTab);
}document.addEventListener("DOMContentLoaded", () => {
  restoreUserSession(); // ⏳ Restore UI first

  // ✅ Then load Firebase
  firebase.initializeApp(firebaseConfig);
  firebase.database().ref("/streams").once("value").then((snapshot) => {
    renderStreams(snapshot.val()); // Your custom renderer
  });
});let uiReady = false;

function restoreUserSession() {
  // Restore logic...
  uiReady = true;
}

firebase.database().ref("/streams").on("value", (snapshot) => {
  if (!uiReady) return; // ⛔ Skip rendering until UI is ready
  renderStreams(snapshot.val());
});firebase.database().ref("/streams").once("value").then((snapshot) => {
  const data = snapshot.val();
  localStorage.setItem("cachedStreams", JSON.stringify(data));
  renderStreams(data);
});const cached = JSON.parse(localStorage.getItem("cachedStreams"));
if (cached) renderStreams(cached);
