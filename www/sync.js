// sync.js – robust version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp';
const SYNC_API_URL = `${SUPABASE_URL}/functions/v1/sync-api`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let syncInterval = null;

// Handle deep link redirect from Google auth
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

function showStatus(msg, isError = false) {
  const el = document.getElementById('sync-status-msg');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#ff4d4d' : '#4caf50';
    setTimeout(() => { el.textContent = ''; }, 4000);
  }
  console.log(msg);
}

function getCurrentSessions() {
  if (!window.StateManager) {
    console.error('StateManager not loaded!');
    return [];
  }
  const state = window.StateManager.loadState();
  return state.sessions || [];
}

function setSessions(sessions) {
  if (!window.StateManager) return false;
  const state = window.StateManager.loadState();
  state.sessions = sessions;
  state.stats = window.StateManager.computeStats(sessions);
  window.StateManager.saveState(state);
  window.dispatchEvent(new Event('tracker:update'));
  return true;
}

// ── Google Sign-In ──────────────────────────────────────────
export async function signInWithGoogle() {
  if (!window.cordova || !cordova.InAppBrowser) {
    showStatus('Browser plugin not ready', true);
    return;
  }
  showStatus('Opening Google sign-in...');
  // ... rest of function
}
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'com.asphalts.legacy://login',
      skipBrowserRedirect: true  // prevent Supabase from redirecting itself
    }
  });

  if (error) {
    showStatus('Google sign-in failed: ' + error.message, true);
    return;
  }

  // Open in system browser via InAppBrowser
  const browser = cordova.InAppBrowser.open(
    data.url,
    '_blank',
    'location=yes,clearcache=yes,clearsessioncache=yes'
  );

  // Listen for the deep link redirect
  browser.addEventListener('loadstart', (event) => {
    if (event.url.startsWith('com.asphalts.legacy://login')) {
      browser.close();
      
      const hash = event.url.split('#')[1] || event.url.split('?')[1];
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          }).then(({ error }) => {
            if (error) showStatus('Login failed: ' + error.message, true);
            else showStatus('✅ Signed in successfully');
          });
        }
      }
    }
  });


// ── Email Sign-In ───────────────────────────────────────────
export async function signInWithEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) showStatus('Sign-in failed: ' + error.message, true);
}

// ── Email Sign-Up ───────────────────────────────────────────
export async function signUpWithEmail(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) showStatus('Sign-up failed: ' + error.message, true);
  else showStatus('✅ Check your email to confirm');
}

// ── Sign Out ────────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut();
  showStatus('Signed out');
}

// ── Sync ────────────────────────────────────────────────────
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

// ── Auth Init ───────────────────────────────────────────────
function updateUIForLoggedInUser() {
  document.getElementById('auth-section')?.classList.add('hidden');
  document.getElementById('sync-controls')?.classList.remove('hidden');
}

function updateUIForLoggedOutUser() {
  document.getElementById('auth-section')?.classList.remove('hidden');
  document.getElementById('sync-controls')?.classList.add('hidden');
}

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    updateUIForLoggedInUser();
    startAutoSync();
    await pullSync(false);
  } else {
    updateUIForLoggedOutUser();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      currentUser = session.user;
      updateUIForLoggedInUser();
      startAutoSync();
      pullSync(false);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateUIForLoggedOutUser();
      stopAutoSync();
    }
  });
}

function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => pushSync(false), 3600000);
}

function stopAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
}

// ── DOM Listeners ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Cordova to be fully ready before attaching anything
  document.addEventListener('deviceready', () => {
    initAuth();
    document.getElementById('btn-google-signin')?.addEventListener('click', () => signInWithGoogle());
    document.getElementById('btn-sync-push')?.addEventListener('click', () => pushSync(true));
    document.getElementById('btn-sync-pull')?.addEventListener('click', () => pullSync(true));
    document.getElementById('btn-signout')?.addEventListener('click', () => signOut());
  }, false);
});