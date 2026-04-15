window.StateManager = (function() {
  const STATE_VERSION = 2;
  const STORAGE_KEY = 'app_state';

  const defaultState = {
    version: STATE_VERSION,
    sessions: [],
    stats: { totalSessions: 0, avgScore: 0 }
  };

  function computeStats(sessions) {
    const total = sessions.filter(s => s.type === 'score').length;
    let sum = 0;
    let count = 0;
    sessions.forEach(s => {
      if (s.type === 'score' && s.details && typeof s.details.score === 'number') {
        sum += s.details.score;
        count++;
      }
    });
    const avgScore = count ? (sum / count) : 0;
    return { totalSessions: total, avgScore: avgScore };
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== STATE_VERSION) return defaultState; // no migration
      return parsed;
    } catch(e) {
      return defaultState;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  return { loadState, saveState, computeStats, defaultState, STATE_VERSION, STORAGE_KEY };
})();