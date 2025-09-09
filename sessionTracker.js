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
