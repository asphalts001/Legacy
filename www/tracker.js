// www/tracker.js
(function () {
  if (!window.StateManager) {
    console.error('StateManager not loaded');
    return;
  }

  const {
    loadState,
    saveState,
    computeStats: baseComputeStats,
    defaultState,
    STATE_VERSION
  } = window.StateManager;

  let state = loadState();

  function persist() {
    saveState(state);
    window.dispatchEvent(new CustomEvent('tracker:update'));
  }

  function sessionToOldFormat(session) {
    if (session.type === 'score') {
      const d = session.details;

      const hasFullData =
        d.correct !== undefined &&
        d.wrong !== undefined &&
        d.skipped !== undefined;

      let correct, wrong, skipped, total, accuracy;
      let topic = d.topic || 'Session';
      let subject = d.subject || 'MCQ';

      if (hasFullData) {
        correct = d.correct;
        wrong = d.wrong;
        skipped = d.skipped;
        total = d.total;
        accuracy =
          d.accuracy !== undefined
            ? d.accuracy
            : correct + wrong > 0
            ? Math.round((correct / (correct + wrong)) * 100)
            : 0;
      } else {
        const neetScore = d.score || 0;
        total = d.total || 0;
        correct = Math.min(total, Math.ceil(neetScore / 4));
        wrong = Math.min(
          total - correct,
          Math.max(0, 4 * correct - neetScore)
        );
        skipped = total - correct - wrong;
        accuracy =
          correct + wrong > 0
            ? Math.round((correct / (correct + wrong)) * 100)
            : 0;
      }

      return {
        type: 'score',
        ts: session.timestamp,
        subject,
        topic,
        score: accuracy,
        correct,
        wrong,
        skipped,
        total,
        attempted: correct + wrong
      };
    }

    // ✅ FIX: added proper read handling + return
    if (session.type === 'read') {
      return {
        type: 'read',
        ts: session.timestamp,
        subject: session.details.subject || 'Reading',
        setId: session.details.setId
      };
    }

    return null;
  }

  // custom computeStats override
  function computeStats(sessions) {
    const scoreSessions = sessions.filter((s) => s.type === 'score');

    const totalSessions = scoreSessions.length;
    let totalQuestions = 0;
    let totalAccuracySum = 0;
    let accuracyCount = 0;

    scoreSessions.forEach((s) => {
      const d = s.details;

      const attempted = (d.correct ?? 0) + (d.wrong ?? 0);
totalQuestions += attempted;

      let acc;

      if (d.accuracy !== undefined) {
        acc = d.accuracy;
      } else if (d.correct !== undefined && d.wrong !== undefined) {
        const attempted = d.correct + d.wrong;
        acc =
          attempted > 0
            ? Math.round((d.correct / attempted) * 100)
            : 0;
      } else if (d.score !== undefined && d.total) {
        const attemptedEstimate = Math.min(
          d.total,
          Math.round((d.score + d.total) / 5)
        );

        acc =
          attemptedEstimate > 0
            ? Math.round(
                (d.score + attemptedEstimate) /
                  (4 * attemptedEstimate) *
                  100
              )
            : 0;
      } else {
        acc = 0;
      }

      if (!isNaN(acc)) {
        totalAccuracySum += acc;
        accuracyCount++;
      }
    });

    const avgAccuracy =
      accuracyCount > 0
        ? Math.round(totalAccuracySum / accuracyCount)
        : 0;

    return {
      totalSessions,
      totalQuestions,
      avgAccuracy
    };
  }

  window.Tracker = {
    logScore: function (details) {
      let sessionDetails;

      if (typeof details === 'object' && details !== null) {
        sessionDetails = {
          subject: details.subject || 'MCQ',
          topic: details.topic || 'Session',
          score: details.score ?? 0,
          correct: details.correct ?? 0,
          wrong: details.wrong ?? 0,
          skipped: details.skipped ?? 0,
          total: details.total ?? 0,
          accuracy:
            details.accuracy ??
            (details.correct + details.wrong > 0
              ? Math.round(
                  (details.correct /
                    (details.correct + details.wrong)) *
                    100
                )
              : 0)
        };
      } else {
        const [score, total, subject = 'MCQ', topic = 'Session'] =
          arguments;
        sessionDetails = { subject, topic, score, total };
      }

      state.sessions.push({
        type: 'score',
        timestamp: Date.now(),
        details: sessionDetails
      });

      state.stats = computeStats(state.sessions);
      persist();
    },

    logRead: function (setId, subject = 'Reading') {
      state.sessions.push({
        type: 'read',
        timestamp: Date.now(),
        details: { setId, subject }
      });

      state.stats = computeStats(state.sessions);
      persist();
    },

    // ✅ FIX: comma added
    reload: function() {
  state = loadState();
  window.dispatchEvent(new CustomEvent('tracker:update'));
},
    getStats: function () {
      const freshStats = computeStats(state.sessions);

      return {
        totalSessions: freshStats.totalSessions || 0,
        totalQuestions: freshStats.totalQuestions || 0,
        avgAccuracy: freshStats.avgAccuracy || 0
      };
    },

    getRecent: function (limit = 10) {
      return state.sessions
        .slice(-limit)
        .reverse()
        .map(sessionToOldFormat)
        .filter((s) => s !== null);
    },

    exportJSON: function () {
      return JSON.stringify(
        {
          version: STATE_VERSION,
          exportedAt: Date.now(),
          sessions: state.sessions,
          stats: state.stats
        },
        null,
        2
      );
    },

    timeAgo: function (timestamp) {
      const seconds = Math.floor(
        (Date.now() - timestamp) / 1000
      );

      if (seconds < 60) return 'just now';

      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;

      return `${Math.floor(hours / 24)}d ago`;
    },

    resetToDefault: function () {
      state = JSON.parse(JSON.stringify(defaultState));
      state.version = STATE_VERSION;
      persist();
    }
  };
})();