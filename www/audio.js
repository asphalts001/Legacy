// audio.js — Cordova Media plugin version for Android
const AudioManager = (() => {
  const KEY = 'musicOn';

  let mediaObj = null;
  let enabled = localStorage.getItem(KEY) !== 'false';
  let pendingTrack = null;
  let ready = false;

  // Cordova fires deviceready when native APIs are available
  document.addEventListener('deviceready', () => {
    ready = true;
    if (pendingTrack) _createMedia(pendingTrack);
  }, false);

  function _getPath(filename) {
    // Android requires this exact prefix to reach www/ assets
    return '/android_asset/www/audio/' + filename;
  }

  function _createMedia(filename) {
    // Release previous
    if (mediaObj) {
      try { mediaObj.stop(); mediaObj.release(); } catch(e) {}
      mediaObj = null;
    }

    mediaObj = new Media(
      _getPath(filename),
      () => {},          // success
      (err) => { console.warn('Media error:', JSON.stringify(err)); },
      (status) => {
        // Status 4 = MEDIA_STOPPED — loop manually
        if (status === Media.MEDIA_STOPPED && enabled) {
          mediaObj.seekTo(0);
          mediaObj.play();
        }
      }
    );

    if (enabled) {
      mediaObj.setVolume(0.3);
      mediaObj.play();
    }

    _renderToggle();
  }

  function init(trackFile) {
    if (ready) {
      _createMedia(trackFile);
    } else {
      // deviceready not fired yet — queue it
      pendingTrack = trackFile;
    }
    // Also re-render toggle in case button already exists
    _renderToggle();
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem(KEY, String(enabled));
    if (mediaObj) {
      if (enabled) {
        mediaObj.seekTo(0);
        mediaObj.play();
      } else {
        mediaObj.pause();
      }
    }
    _renderToggle();
  }

  function _renderToggle() {
    const btn = document.getElementById('music-toggle');
    if (!btn) return;
    btn.textContent = enabled ? '♪' : '♪̶';
    btn.style.color = enabled ? 'var(--accent, #7c6af0)' : 'var(--muted, #6b6b8a)';
    btn.style.borderColor = enabled ? 'var(--accent, #7c6af0)' : '#2e2e4e';
    btn.classList.toggle('on', enabled);
  }

  return { init, toggle };
})();