// audio.js — Global background music
// Each page calls Audio.init('filename.m4a')
// Toggle lives only on index.html, preference saved to localStorage

const AudioManager = (() => {
  const KEY = 'musicOn';
  const FOLDER = 'audiomanager/';

  let player = null;
  let enabled = localStorage.getItem(KEY) !== 'false'; // default ON

  function init(trackFile) {
    player = document.createElement('audiomanager');
    player.src = FOLDER + trackFile;
    player.loop = true;
    player.volume = 0.3;

    // Autoplay is blocked until first user interaction — this handles that
    document.addEventListener('click', _startOnce, { once: true });
    document.addEventListener('touchend', _startOnce, { once: true });

    // If toggle button exists on this page, render it
    _renderToggle();
  }

  function _startOnce() {
    if (enabled) player.play().catch(() => {});
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem(KEY, String(enabled));
    enabled ? player.play().catch(() => {}) : player.pause();
    _renderToggle();
  }

  function _renderToggle() {
    const btn = document.getElementById('music-toggle');
    if (!btn) return;
    btn.textContent = enabled ? '♪' : '♪̶';
    btn.style.color = enabled ? 'var(--accent, #7c6af0)' : 'var(--muted, #6b6b8a)';
    btn.style.borderColor = enabled ? 'var(--accent, #7c6af0)' : '#2e2e4e';
  }

  return { init, toggle };
})();