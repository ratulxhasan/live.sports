const SessionManager = {
  key: "userSession",

  init() {
    const existing = localStorage.getItem(this.key);
    if (!existing) {
      const fresh = {
        theme: "dark",
        lastStream: null,
        selectedTab: null,
        formInputs: {},
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.key, JSON.stringify(fresh));
    }
  },

  get() {
    return JSON.parse(localStorage.getItem(this.key));
  },

  update(updates) {
    const current = this.get();
    const merged = { ...current, ...updates };
    localStorage.setItem(this.key, JSON.stringify(merged));
  },

  restoreUI() {
    const session = this.get();
    if (session.theme) document.body.className = session.theme;
    if (session.lastStream) loadStream(session.lastStream);
    if (session.selectedTab) activateTab(session.selectedTab);

    Object.entries(session.formInputs).forEach(([key, value]) => {
      const el = document.querySelector(`[name='${key}'], #${key}`);
      if (el) el.value = value;
    });
  }
};
