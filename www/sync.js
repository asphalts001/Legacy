// Must be defined at the TOP of sync.js, before anything else,
// before DOMContentLoaded, before deviceready — Cordova calls this
// very early on resume from the system browser.
window.handleOpenURL = function(url) {
  console.log('handleOpenURL fired:', url);
}

// Handles authentication (Google, email) and cloud sync for session data.
// Uses Supabase as backend and Cordova InAppBrowser for OAuth redirects.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp';
const SYNC_API_URL = `${SUPABASE_URL}/functions/v1/sync-api`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;       // Currently authenticated Supabase user
let syncInterval = null;      // Handle for hourly auto-sync fallback
let debounceTimer = null;     // Handle for event-driven push debounce

// ----------------------------------------------------------------------
// Deep link handler for Google OAuth redirect (Cordova specific)
// Google redirects to com.asphalts.legacy://login?access_token=...
// This function extracts the tokens and sets the Supabase session.
// ----------------------------------------------------------------------
window.handleOpenURL = function(url) {
  if (url.includes('com.asphalts.legacy://login')) {
    const hash = url.split('#')[1] || url.split('?')[1];
    if (hash) {
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(({ data, error }) => {
          if (error) showStatus('Login failed: ' + error.message, true);
          else showStatus('✅ Signed in successfully');
        });
      }
    }
  }
};

// ----------------------------------------------------------------------
// Display a temporary status message in the UI and console.
// ----------------------------------------------------------------------
function showStatus(msg, isError = false) {
  const el = document.getElementById('sync-status-msg');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#ff4d4d' : '#4caf50';
    setTimeout(() => { el.textContent = ''; }, 4000);
  }
  console.log(msg);
}

// ----------------------------------------------------------------------
// Retrieve the current list of sessions from the global StateManager.
// ----------------------------------------------------------------------
function getCurrentSessions() {
  if (!window.StateManager) {
    console.error('StateManager not loaded!');
    return [];
  }
  const state = window.StateManager.loadState();
  return state.sessions || [];
}

// ----------------------------------------------------------------------
// Save a new session list, recalc stats, persist, and notify the UI.
// If Tracker is present, call its reload() method to refresh in-memory state.
// ----------------------------------------------------------------------
function setSessions(sessions) {
  if (!window.StateManager) return false;

  const state = window.StateManager.loadState();
  state.sessions = sessions;
  state.stats = window.StateManager.computeStats(sessions);
  window.StateManager.saveState(state);

  if (window.Tracker && window.Tracker.reload) {
    window.Tracker.reload();
  } else {
    window.dispatchEvent(new Event('tracker:update'));
  }
  return true;
}

// ----------------------------------------------------------------------
// Google Sign-In (opens system browser because Google blocks embedded WebViews)
// ----------------------------------------------------------------------
export async function signInWithGoogle() {
  showStatus('Opening Google sign-in...');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'com.asphalts.legacy://login'
    }
  });

  if (error) {
    showStatus('Google sign-in failed: ' + error.message, true);
    return;
  }

  if (window.cordova) {
    cordova.InAppBrowser.open(data.url, '_system', '');
  } else {
    window.open(data.url, '_system');
  }
}

// ----------------------------------------------------------------------
// Email / Password Sign-In
// ----------------------------------------------------------------------
export async function signInWithEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) showStatus('Sign-in failed: ' + error.message, true);
}

// ----------------------------------------------------------------------
// Email / Password Sign-Up (sends confirmation email)
// ----------------------------------------------------------------------
export async function signUpWithEmail(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) showStatus('Sign-up failed: ' + error.message, true);
  else showStatus('✅ Check your email to confirm');
}

// ----------------------------------------------------------------------
// Sign Out
// ----------------------------------------------------------------------
export async function signOut() {
  await supabase.auth.signOut();
  showStatus('Signed out');
}

// ----------------------------------------------------------------------
// Push local sessions to the cloud (PUT /sync-api)
// ----------------------------------------------------------------------
async function pushSync(showToast = true) {
  if (!currentUser) {
    if (showToast) showStatus('Not logged in', true);
    return false;
  }

  const sessions = getCurrentSessions();
  if (showToast) showStatus(`Pushing ${sessions.length} sessions...`);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(SYNC_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ data: sessions })
    });

    if (!res.ok) throw new Error(await res.text());
    if (showToast) showStatus('✅ Cloud updated');
    return true;

  } catch (err) {
    console.error(err);
    if (showToast) showStatus(`Push failed: ${err.message}`, true);
    return false;
  }
}

// ----------------------------------------------------------------------
// Pull sessions from the cloud and overwrite local state (GET /sync-api)
// ----------------------------------------------------------------------
async function pullSync(showToast = true) {
  if (!currentUser) {
    if (showToast) showStatus('Not logged in', true);
    return false;
  }

  if (showToast) showStatus('Restoring from cloud...');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(SYNC_API_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY
      }
    });

    if (!res.ok) throw new Error(await res.text());

    let cloudData = await res.json();
    if (cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData)) {
      cloudData = cloudData.data || [];
    }
    if (!Array.isArray(cloudData)) throw new Error('Invalid data format from cloud');

    console.log(`📥 Pulled ${cloudData.length} sessions`);
    const success = setSessions(cloudData);
    if (success && showToast) showStatus(`✅ Restored ${cloudData.length} sessions`);
    return success;

  } catch (err) {
    console.error(err);
    if (showToast) showStatus(`Restore failed: ${err.message}`, true);
    return false;
  }
}

// ----------------------------------------------------------------------
// UI helpers: toggle visibility of auth section vs. sync controls.
// ----------------------------------------------------------------------
function updateUIForLoggedInUser() {
  document.getElementById('auth-section')?.classList.add('hidden');
  document.getElementById('sync-controls')?.classList.remove('hidden');

  const emailEl = document.getElementById('user-email-display');
  if (emailEl && currentUser) {
    emailEl.textContent = currentUser.email;
  }
}

function updateUIForLoggedOutUser() {
  document.getElementById('auth-section')?.classList.remove('hidden');
  document.getElementById('sync-controls')?.classList.add('hidden');
}

// ----------------------------------------------------------------------
// Event-driven push: fires 3s after any StateManager.saveState() call.
// Hourly interval acts as a fallback safety net.
// ----------------------------------------------------------------------
function schedulePush() {
  if (!currentUser) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => pushSync(false), 3000);
}

function startAutoSync() {
  window.addEventListener('statemanager:saved', schedulePush);
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => pushSync(false), 3600000);
}

function stopAutoSync() {
  window.removeEventListener('statemanager:saved', schedulePush);
  clearTimeout(debounceTimer);
  debounceTimer = null;
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}

// ----------------------------------------------------------------------
// Initialise authentication state, set up listeners, and start auto-sync.
// ----------------------------------------------------------------------
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    updateUIForLoggedInUser();
    startAutoSync();
  } else {
    updateUIForLoggedOutUser();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      currentUser = session.user;
      updateUIForLoggedInUser();
      startAutoSync();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateUIForLoggedOutUser();
      stopAutoSync();
    }
  });
}

// ----------------------------------------------------------------------
// Wire up DOM event listeners once the page is loaded.
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  document.getElementById('btn-signin')?.addEventListener('click', () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    signInWithEmail(email, password);
  });

  document.getElementById('btn-signup')?.addEventListener('click', () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    signUpWithEmail(email, password);
  });

  document.getElementById('btn-google-signin')?.addEventListener('click', () => {
    console.log('Google signin clicked');
    signInWithGoogle();
  });

  document.getElementById('btn-sync-push')?.addEventListener('click', () => pushSync(true));
  document.getElementById('btn-sync-pull')?.addEventListener('click', () => pullSync(true));
  document.getElementById('btn-signout')?.addEventListener('click', () => signOut());
});

// Cordova deviceready event
document.addEventListener('deviceready', () => {
  console.log('Cordova ready');
}, false);