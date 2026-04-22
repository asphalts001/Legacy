// sync.js – robust version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp';
const SYNC_API_URL = `${SUPABASE_URL}/functions/v1/sync-api`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let syncInterval = null;

function showStatus(msg, isError = false) {
  const el = document.getElementById('sync-status-msg');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#ff4d4d' : '#4caf50';
    setTimeout(() => { el.textContent = ''; }, 4000);
  }
  console.log(msg);
}

// Helper to get current sessions from StateManager
function getCurrentSessions() {
  if (!window.StateManager) {
    console.error('StateManager not loaded!');
    return [];
  }
  const state = window.StateManager.loadState();
  return state.sessions || [];
}

// Helper to replace sessions and recalc stats
function setSessions(sessions) {
  if (!window.StateManager) return false;
  const state = window.StateManager.loadState();
  state.sessions = sessions;
  state.stats = window.StateManager.computeStats(sessions);
  window.StateManager.saveState(state);
  window.dispatchEvent(new Event('tracker:update'));
  return true;
}

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
    // Support both { data: [...] } and direct array
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

// Auth & UI updates (keep your existing code for signIn, signUp, etc.)
// ... (I'll assume you keep your original auth handlers, just replace push/pull)

// Initialize
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('auth-section')?.classList.add('hidden');
    document.getElementById('sync-controls')?.classList.remove('hidden');
    startAutoSync();
    await pullSync(false); // silent pull on login
  } else {
    document.getElementById('auth-section')?.classList.remove('hidden');
    document.getElementById('sync-controls')?.classList.add('hidden');
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
function stopAutoSync() { if (syncInterval) clearInterval(syncInterval); }

// DOM listeners (attach after loading)
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  // ... attach your button listeners (signin, signup, sync-push, sync-pull)
  document.getElementById('btn-sync-push')?.addEventListener('click', () => pushSync(true));
  document.getElementById('btn-sync-pull')?.addEventListener('click', () => pullSync(true));
});