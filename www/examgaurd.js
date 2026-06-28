/**
 * examguard.js – Cordova exam proctoring
 * Enforces: Wi-Fi OFF, Mobile data OFF, no internet.
 * Monitors connectivity, app pause/resume, screen visibility.
 * Violations: 1st warning, 2nd final warning, 3rd auto‑submit.
 */
(function() {
  'use strict';

  const VIOLATION_LIMIT = 3;
  const CHECK_INTERVAL_MS = 2000; // periodic connectivity check

  let violationCount = 0;
  let monitoring = false;
  let checkInterval = null;
  let callbacks = { onViolation: null, onAutoSubmit: null };

  // ---------- helpers ----------
  function isOnline() {
    return navigator.onLine === true;
  }

  function getReason() {
    if (isOnline()) {
      return 'Internet connection is active. Please turn off Wi-Fi and mobile data.';
    }
    return null; // all good
  }

  // ---------- public API ----------
  const ExamGuard = {
    /**
     * Check if exam can start.
     * @returns { { allowed: boolean, reason: string } }
     */
    canStartExam() {
      const reason = getReason();
      if (reason) {
        return { allowed: false, reason };
      }
      return { allowed: true, reason: '' };
    },

    /**
     * Start monitoring.
     * @param {Object} options
     * @param {Function} options.onViolation - called with (violationCount, source)
     * @param {Function} options.onAutoSubmit - called when limit reached
     */
    startMonitoring(options) {
      if (monitoring) return;
      if (typeof options !== 'object') options = {};
      callbacks.onViolation = options.onViolation || null;
      callbacks.onAutoSubmit = options.onAutoSubmit || null;

      // Reset count when starting fresh
      violationCount = 0;
      monitoring = true;

      // ---- event listeners ----
      const handleOnline = () => {
        if (!monitoring) return;
        recordViolation('online');
      };
      const handleOffline = () => {
        // ignore – going offline is fine, only online is a violation
      };
      const handlePause = () => {
        if (!monitoring) return;
        recordViolation('pause');
      };
      const handleVisibilityChange = () => {
        if (!monitoring) return;
        if (document.hidden) {
          recordViolation('visibility');
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      document.addEventListener('pause', handlePause); // Cordova
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // store for cleanup
      ExamGuard._listeners = {
        online: handleOnline,
        offline: handleOffline,
        pause: handlePause,
        visibility: handleVisibilityChange
      };

      // ---- periodic check ----
      checkInterval = setInterval(() => {
        if (!monitoring) return;
        if (isOnline()) {
          recordViolation('periodic');
        }
      }, CHECK_INTERVAL_MS);
    },

    /**
     * Stop monitoring and remove listeners.
     */
    stopMonitoring() {
      monitoring = false;
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      // remove listeners
      const listeners = ExamGuard._listeners || {};
      window.removeEventListener('online', listeners.online);
      window.removeEventListener('offline', listeners.offline);
      document.removeEventListener('pause', listeners.pause);
      document.removeEventListener('visibilitychange', listeners.visibility);
      ExamGuard._listeners = {};
      // reset callbacks
      callbacks.onViolation = null;
      callbacks.onAutoSubmit = null;
    },

    /**
     * Reset violation counter (without stopping monitoring).
     */
    reset() {
      violationCount = 0;
    },

    /**
     * Get current violation count.
     */
    getViolationCount() {
      return violationCount;
    }
  };

  // ---------- internal ----------
  function recordViolation(source) {
    if (!monitoring) return;
    violationCount += 1;
    // call onViolation callback
    if (typeof callbacks.onViolation === 'function') {
      callbacks.onViolation(violationCount, source);
    }
    // if limit reached, auto‑submit
    if (violationCount >= VIOLATION_LIMIT) {
      if (typeof callbacks.onAutoSubmit === 'function') {
        callbacks.onAutoSubmit();
      }
      // stop further monitoring after auto‑submit
      ExamGuard.stopMonitoring();
    }
  }

  // Expose globally
  window.ExamGuard = ExamGuard;

})();
