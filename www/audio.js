// audio.js — Debug version
const AudioManager = (() => {
  const KEY = 'musicOn';

  let mediaObj = null;
  let enabled = localStorage.getItem(KEY) !== 'false';
  let pendingTrack = null;
  let ready = false;

  function _log(msg) {
    console.log('[AudioManager] ' + msg);
    // Also show on screen so you can see without logcat
    let box = document.getElementById('_audio_debug');
    if (!box) {
      box = document.createElement('div');
      box.id = '_audio_debug';
      box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#000;color:#0f0;font-size:11px;padding:6px;z-index:99999;max-height:160px;overflow-y:auto;font-family:monospace;';
      document.body.appendChild(box);
    }
    box.innerHTML += msg + '<br>';
    box.scrollTop = box.scrollHeight;
  }

  document.addEventListener('deviceready', () => {
    _log('deviceready fired');
    _log('Media type: ' + typeof Media);
    ready = true;
    if (pendingTrack) {
      _log('playing pending track: ' + pendingTrack);
      _createMedia(pendingTrack);
    }
  }, false);

  function _getPath(filename) {
    const path = '/android_asset/www/audio/' + filename;
    _log('path: ' + path);
    return path;
  }

  function _createMedia(filename) {
    _log('_createMedia: ' + filename);
    _log('Media available: ' + (typeof Media !== 'undefined'));

    if (typeof Media === 'undefined') {
      _log('ERROR: Media plugin not available!');
      return;
    }

    if (mediaObj) {
      try { mediaObj.stop(); mediaObj.release(); } catch(e) { _log('release err: ' + e); }
      mediaObj = null;
    }

    const path = _getPath(filename);
    _log('creating Media object...');

    let volumeSet = false;
    mediaObj = new Media(
      path,
      () => { _log('Media success cb'); },
      (err) => { _log('Media ERROR: ' + JSON.stringify(err)); },
      (status) => {
        _log('Media status: ' + status);
        if (status === Media.MEDIA_RUNNING && !volumeSet) {
          volumeSet = true;
          mediaObj.setVolume(0.3);
          _log('volume set');
        }
        if (status === Media.MEDIA_STOPPED && enabled) {
          _log('looping...');
          mediaObj.seekTo(0);
          mediaObj.play();
        }
      }
    );

    _log('Media object created, enabled=' + enabled);
    if (enabled) {
      _log('calling play()...');
      mediaObj.play();
    }

    _renderToggle();
  }

  function init(trackFile) {
    _log('init called: ' + trackFile + ', ready=' + ready);
    if (ready) {
      _createMedia(trackFile);
    } else {
      pendingTrack = trackFile;
      _log('queued, waiting for deviceready');
    }
    _renderToggle();
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem(KEY, String(enabled));
    _log('toggle: enabled=' + enabled);
    if (mediaObj) {
      if (enabled) { mediaObj.seekTo(0); mediaObj.play(); }
      else { mediaObj.pause(); }
    }
    _renderToggle();
  }

  function _renderToggle() {
    // button may not exist yet if script runs in <head> or on pages without the toggle
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
