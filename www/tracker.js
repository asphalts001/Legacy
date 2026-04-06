/* ═══════════════════════════════════════════════════
   tracker.js  —  StudyApp activity logger
   Exposed as: window.Tracker (IIFE module)

   Methods:
     Tracker.logScore(opts)   — save a quiz result
     Tracker.logRead(opts)    — save a chapter read
     Tracker.getStats()       — totals for dashboard stats row
     Tracker.getRecent(n)     — last n events for activity feed
     Tracker.exportJSON()     — full log as JSON string
     Tracker.timeAgo(ts)      — human-readable "X min ago"
   ═══════════════════════════════════════════════════ */

window.Tracker = (function () {

  const KEY = 'studyapp_log';

  /* ── private helpers ── */

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  function save(log) {
    try { localStorage.setItem(KEY, JSON.stringify(log)); }
    catch (e) { console.warn('Tracker: could not save', e); }
  }

  function push(entry) {
    const log = load();
    log.unshift(entry);          // newest first
    save(log.slice(0, 200));     // keep last 200 events max
  }

  /* ── public API ── */

  /**
   * Log a quiz result.
   * opts = {
   *   subject : 'MCQ' | 'Physics' | 'Chemistry'   (default: 'MCQ')
   *   topic   : string   label shown in activity feed
   *   set     : string   internal set id  (e.g. 'set_07')
   *   score   : number   percentage 0–100
   *   correct : number
   *   wrong   : number
   *   skip    : number
   *   total   : number
   * }
   */
  function logScore(opts) {
    const correct = opts.correct || 0;
    const total   = opts.total   || 1;
    const score   = opts.score !== undefined
      ? Math.round(opts.score)
      : Math.round((correct / total) * 100);

    push({
      type    : 'score',
      ts      : Date.now(),
      subject : opts.subject || 'MCQ',
      topic   : opts.topic   || opts.label || opts.set || 'Unknown set',
      set     : opts.set     || '',
      score,
      correct,
      wrong   : opts.wrong || 0,
      skip    : opts.skip  || 0,
      total
    });
  }

  /**
   * Log a chapter read.
   * opts = {
   *   subject : 'Physics' | 'Chemistry'
   *   chapter : string   chapter / section name
   * }
   */
  function logRead(opts) {
    push({
      type    : 'read',
      ts      : Date.now(),
      subject : opts.subject || 'Physics',
      chapter : opts.chapter || 'Unknown chapter'
    });
  }

  /**
   * Returns aggregate stats for the dashboard stats row.
   * { totalQuestions, totalSessions, avgScore }
   */
  function getStats() {
    const log      = load();
    const scores   = log.filter(e => e.type === 'score');
    const total    = scores.reduce((s, e) => s + (e.total || 0), 0);
    const avgScore = scores.length
      ? Math.round(scores.reduce((s, e) => s + (e.score || 0), 0) / scores.length)
      : 0;
    return {
      totalQuestions : total,
      totalSessions  : scores.length,
      avgScore
    };
  }

  /**
   * Returns the last n events (both score and read) for the activity feed.
   */
  function getRecent(n) {
    return load().slice(0, n || 8);
  }

  /**
   * Returns the full log as a formatted JSON string for export.
   */
  function exportJSON() {
    return JSON.stringify({
      exported : new Date().toISOString(),
      version  : '1.0',
      log      : load()
    }, null, 2);
  }

  /**
   * Converts a timestamp to a human-readable relative string.
   * e.g. "2 min ago", "3 hrs ago", "Yesterday", "12 Jan"
   */
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const min  = Math.floor(diff / 60000);
    const hr   = Math.floor(diff / 3600000);
    const day  = Math.floor(diff / 86400000);

    if (min < 1)   return 'Just now';
    if (min < 60)  return min  + ' min ago';
    if (hr  < 24)  return hr   + ' hr'  + (hr  > 1 ? 's' : '') + ' ago';
    if (day === 1) return 'Yesterday';
    if (day < 7)   return day  + ' day' + (day > 1 ? 's' : '') + ' ago';

    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  /* ── expose ── */
  return { logScore, logRead, getStats, getRecent, exportJSON, timeAgo };

})();