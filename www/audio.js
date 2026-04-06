// audio.js
const AudioManager = (() => {
  const KEY = 'musicOn';

  let mediaObj = null;
  let enabled = localStorage.getItem(KEY) !== 'false';
  let pendingTrack = null;
  let ready = false;

  document.addEventListener('deviceready', () => {
    ready = true;
    if (pendingTrack) {
      _createMedia(pendingTrack);
    }
  }, false);

  function _getPath(filename) {
    return '/android_asset/www/audio/' + filename;
  }

  function _createMedia(filename) {
    if (typeof Media === 'undefined') return;

    if (mediaObj) {
      try { mediaObj.stop(); mediaObj.release(); } catch(e) {}
      mediaObj = null;
    }

    let volumeSet = false;
    mediaObj = new Media(
      _getPath(filename),
      null,
      (err) => { console.warn('[AudioManager] error:', JSON.stringify(err)); },
      (status) => {
        if (status === Media.MEDIA_RUNNING && !volumeSet) {
          volumeSet = true;
          mediaObj.setVolume(0.3);
        }
        if (status === Media.MEDIA_STOPPED && enabled) {
          mediaObj.seekTo(0);
          mediaObj.play();
        }
      }
    );

    if (enabled) mediaObj.play();
    _renderToggle();
  }

  function init(trackFile) {
    if (ready) {
      _createMedia(trackFile);
    } else {
      pendingTrack = trackFile;
    }
    _renderToggle();
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem(KEY, String(enabled));
    if (mediaObj) {
      if (enabled) { mediaObj.seekTo(0); mediaObj.play(); }
      else { mediaObj.pause(); }
    }
    _renderToggle();
  }

  function _renderToggle() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', _renderToggle); return; }
    const btn = document.getElementById('music-toggle');
    if (!btn) return;
    btn.textContent = enabled ? '♪' : '♪̶';
    btn.style.color = enabled ? 'var(--accent, #7c6af0)' : 'var(--muted, #6b6b8a)';
    btn.style.borderColor = enabled ? 'var(--accent, #7c6af0)' : '#2e2e4e';
    btn.classList.toggle('on', enabled);
  }

  return { init, toggle };
})();
