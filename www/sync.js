// Detect if running in Cordova (native app)
const isCordova = () => !!window.cordova;

// sync.js – Supabase Email/Password Auth + Background Auto-Sync
console.log('✅ sync.js loaded');

const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp';
const SYNC_API_URL = `${SUPABASE_URL}/functions/v1/sync-api`;

// Import Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Global State ---
let currentUser = null;
let syncInterval = null;

// --- Cordova Deep Link Handler ---
if (isCordova()) {
  document.addEventListener('deviceready', () => {
    const handleOpenURL = (url) => {
      console.log('🔗 App opened with URL:', url);
      if (url && url.startsWith('legacy://')) {
        supabase.auth.getSessionFromUrl({ url }).then(({ data, error }) => {
          if (error) console.error('Deep link auth error:', error);
          else console.log('✅ Google sign-in completed via deep link');
        });
      }
    };

    window.handleOpenURL = handleOpenURL;

    if (window.cordova.plugins && window.cordova.plugins.launch) {
      window.cordova.plugins.launch.getLaunchURL(handleOpenURL);
    }
  }, false);
}

// --- UI Helper ---
function showStatus(message, isError = false) {
  console.log(`📢 Status: ${message} ${isError ? '(ERROR)' : ''}`);
  const statusEl = document.getElementById('sync-status-msg');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ff4d4d' : '#4caf50';
    setTimeout(() => { statusEl.textContent = ''; }, 4000);
  }
}

// --- Theme Management ---
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('app_theme', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('app_theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}

function initTheme() {
  const saved = localStorage.getItem('app_theme') || 'light';
  applyTheme(saved);
}

// --- Check Auth State on Load ---
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    currentUser = session.user;
    console.log('🔐 User already logged in:', currentUser.email);
    updateUIForLoggedInUser();
    startAutoSync();
    await pullSync();
  } else {
    console.log('👤 No active session');
    updateUIForLoggedOutUser();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      updateUIForLoggedInUser();
      startAutoSync();
      pullSync();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateUIForLoggedOutUser();
      stopAutoSync();
    }
  });
}

// --- UI Updates ---
function updateUIForLoggedInUser() {
  document.getElementById('auth-section')?.classList.add('hidden');
  document.getElementById('sync-controls')?.classList.remove('hidden');
  const emailEl = document.getElementById('user-email-display');
  if (emailEl) emailEl.textContent = currentUser?.email || '';
}

function updateUIForLoggedOutUser() {
  document.getElementById('auth-section')?.classList.remove('hidden');
  document.getElementById('sync-controls')?.classList.add('hidden');
}

// --- Auth Actions ---
async function signUp(email, password) {
  showStatus("Signing up...");
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return showStatus(`Sign-up failed: ${error.message}`, true);
  showStatus("Sign-up successful! You can now sign in.");
}

async function signIn(email, password) {
  showStatus("Signing in...");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return showStatus(`Sign-in failed: ${error.message}`, true);
  showStatus("Signed in successfully!");
}

async function signOut() {
  await supabase.auth.signOut();
  showStatus("Signed out");
}

// --- Google Sign-In (single, Cordova-aware) ---
async function signInWithGoogle() {
  showStatus("Redirecting to Google...");

  const redirectTo = isCordova()
    ? 'legacy://callback'
    : window.location.origin + window.location.pathname;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });

  if (error) {
    showStatus(`Google sign-in failed: ${error.message}`, true);
  }
}

// --- Sync Functions ---
// sync.js – updated sections (replace pushSync and pullSync)

async function pushSync(showToast = true) {
  if (!currentUser) {
    if (showToast) showStatus("You must be logged in to sync", true);
    return;
  }

  // Get real data from StateManager
  const state = window.StateManager.loadState();
  const sessions = state.sessions;

  if (showToast) showStatus("Syncing to cloud...");

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(SYNC_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ data: sessions })  // send only sessions array
    });

    if (!res.ok) throw new Error(await res.text());
    if (showToast) showStatus("Cloud updated successfully!");
  } catch (err) {
    console.error(err);
    if (showToast) showStatus(`Sync failed: ${err.message}`, true);
  }
}

async function pullSync(showToast = true) {
  if (!currentUser) {
    if (showToast) showStatus("You must be logged in to restore", true);
    return;
  }

  if (showToast) showStatus("Restoring from cloud...");

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(SYNC_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!res.ok) throw new Error(await res.text());

    const cloudData = await res.json();
    if (cloudData && Array.isArray(cloudData)) {
      // Load current state, replace sessions, recalc stats
      const currentState = window.StateManager.loadState();
      currentState.sessions = cloudData;
      currentState.stats = window.StateManager.computeStats(cloudData);
      window.StateManager.saveState(currentState);
      
      // Notify dashboard
      window.dispatchEvent(new Event('tracker:update'));
      if (showToast) showStatus("Restored successfully!");
    }
  } catch (err) {
    console.error(err);
    if (showToast) showStatus(`Restore failed: ${err.message}`, true);
  }
}

// --- Auto Sync ---
function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    console.log('⏰ Auto-sync triggered');
    pushSync(false);
  }, 3600000);
  console.log('⏰ Auto-sync started');
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTheme();

  const email = document.getElementById('auth-email');
  const password = document.getElementById('auth-password');
  const toggleBtn = document.getElementById('toggle-password-visibility');

  document.getElementById('btn-signup')?.addEventListener('click', () => {
    signUp(email.value, password.value);
  });

  document.getElementById('btn-signin')?.addEventListener('click', () => {
    signIn(email.value, password.value);
  });

  document.getElementById('btn-signout')?.addEventListener('click', signOut);

  if (toggleBtn && password) {
    toggleBtn.addEventListener('click', () => {
      const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
      password.setAttribute('type', type);
      toggleBtn.textContent = type === 'password' ? '◾' : '👁️‍🗨️';
    });
  }

  document.getElementById('btn-google-signin')?.addEventListener('click', signInWithGoogle);

  document.getElementById('btn-sync-push')?.addEventListener('click', () => pushSync(true));
  document.getElementById('btn-sync-pull')?.addEventListener('click', () => pullSync(true));

  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

  document.getElementById('btn-more-menu')?.addEventListener('click', () => {
    document.getElementById('more-menu-panel')?.classList.toggle('hidden');
    document.getElementById('menu-overlay')?.classList.toggle('hidden');
  });

  document.getElementById('btn-close-menu')?.addEventListener('click', () => {
    document.getElementById('more-menu-panel')?.classList.add('hidden');
    document.getElementById('menu-overlay')?.classList.add('hidden');
  });
});


