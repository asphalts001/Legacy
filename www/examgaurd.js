/**
 * examguard.js – Reliable Cordova exam proctoring with full logging
 */
(function() {
  'use strict';

  const VIOLATION_LIMIT = 3;
  const CHECK_INTERVAL_MS = 3000;   // every 3s
  const PING_TIMEOUT_MS = 4000;
  const PING_URL = 'https://www.google.com/generate_204';

  let violationCount = 0;
  let monitoring = false;
  let checkInterval = null;
  let callbacks = { onViolation: null, onAutoSubmit: null };

  // ---------- logger ----------
  function log(...args) {
    console.log('[ExamGuard]', ...args);
  }
  function warn(...args) {
    console.warn('[ExamGuard]', ...args);
  }
  function error(...args) {
    console.error('[ExamGuard]', ...args);
  }

  // ---------- real connectivity test ----------
  async function hasInternetConnection() {
    log('Testing internet connectivity via HEAD to', PING_URL);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

      const response = await fetch(PING_URL, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      log('Internet reachable: YES');
      return true;
    } catch (err) {
      log('Internet reachable: NO (', err.message || err, ')');
      return false;
    }
  }

  // ---------- start check ----------
  async function canStartExamInternal() {
    log('Performing start-check...');
    // quick navigator.onLine
    if (!navigator.onLine) {
      log('navigator.onLine = false → offline, allowed');
      return { allowed: true, reason: '' };
    }
    log('navigator.onLine = true, verifying with ping...');
    const online = await hasInternetConnection();
    if (online) {
      warn('Actual internet detected → start blocked');
      return { allowed: false, reason: 'Internet connection detected. Please turn off Wi-Fi and mobile data.' };
    } else {
      log('No actual internet → start allowed');
      return { allowed: true, reason: '' };
    }
  }

  // ---------- record violation ----------
  function recordViolation(source) {
    if (!monitoring) {
      warn('Violation recorded but monitoring is false – ignoring');
      return;
    }
    violationCount += 1;
    warn(`Violation #${violationCount} (source: ${source})`);
    log('Calling onViolation callback...');
    if (typeof callbacks.onViolation === 'function') {
      callbacks.onViolation(violationCount, source);
    } else {
      warn('No onViolation callback provided');
    }
    if (violationCount >= VIOLATION_LIMIT) {
      log('Violation limit reached – triggering auto-submit');
      if (typeof callbacks.onAutoSubmit === 'function') {
        callbacks.onAutoSubmit();
      } else {
        warn('No onAutoSubmit callback provided');
      }
      ExamGuard.stopMonitoring();
    }
  }

  // ---------- public API ----------
  const ExamGuard = {
    canStartExam: canStartExamInternal,

    startMonitoring(options) {
      if (monitoring) {
        log('Monitoring already active – ignoring startMonitoring call');
        return;
      }
      log('Starting monitoring with options:', options);
      if (typeof options !== 'object') options = {};
      callbacks.onViolation = options.onViolation || null;
      callbacks.onAutoSubmit = options.onAutoSubmit || null;

      violationCount = 0;
      monitoring = true;
      log('Violation counter reset, monitoring = true');

      // --- event listeners ---
      const handleOnline = () => {
        log('Online event fired (navigator.onLine = true)');
        // we'll rely on periodic check
      };
      const handleOffline = () => {
        log('Offline event fired (navigator.onLine = false) – no violation');
      };
      const handlePause = () => {
        log('Pause event fired (app backgrounded)');
        if (monitoring) recordViolation('pause');
      };
      const handleVisibilityChange = () => {
        log('Visibility change: hidden =', document.hidden);
        if (monitoring && document.hidden) recordViolation('visibility');
      };
      const handleBlur = () => {
        log('Window blur event (lost focus)');
        if (monitoring) recordViolation('blur');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      document.addEventListener('pause', handlePause);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);

      ExamGuard._listeners = {
        online: handleOnline,
        offline: handleOffline,
        pause: handlePause,
        visibility: handleVisibilityChange,
        blur: handleBlur
      };
      log('All event listeners attached');

      // --- periodic check ---
      checkInterval = setInterval(async () => {
        if (!monitoring) {
          log('Periodic check skipped – monitoring false');
          return;
        }
        log('Periodic check running...');
        if (!navigator.onLine) {
          log('navigator.onLine = false, no violation');
          return;
        }
        const online = await hasInternetConnection();
        if (online) {
          warn('Periodic check detected internet – violation');
          recordViolation('periodic');
        } else {
          log('Periodic check – no internet');
        }
      }, CHECK_INTERVAL_MS);
      log('Periodic check interval set (', CHECK_INTERVAL_MS, 'ms)');
    },

    stopMonitoring() {
      if (!monitoring) {
        log('stopMonitoring called but not active');
        return;
      }
      log('Stopping monitoring...');
      monitoring = false;
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
        log('Cleared periodic check interval');
      }
      const listeners = ExamGuard._listeners || {};
      window.removeEventListener('online', listeners.online);
      window.removeEventListener('offline', listeners.offline);
      document.removeEventListener('pause', listeners.pause);
      document.removeEventListener('visibilitychange', listeners.visibility);
      window.removeEventListener('blur', listeners.blur);
      ExamGuard._listeners = {};
      callbacks.onViolation = null;
      callbacks.onAutoSubmit = null;
      log('Monitoring stopped and listeners removed');
    },

    reset() {
      log('Resetting violation count (was', violationCount, ')');
      violationCount = 0;
    },

    getViolationCount() {
      return violationCount;
    }
  };

  window.ExamGuard = ExamGuard;
  log('ExamGuard loaded successfully');
})();
