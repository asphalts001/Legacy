// sync.js – Supabase Edge Function integration
const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp';

// --- UID Management ---
function getOrGenerateUID() {
  let uid = localStorage.getItem('studyapp_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('studyapp_uid', uid);
  }
  return uid;
}

function updateUIDDisplay() {
  const uidInput = document.getElementById('input-uid');
  if (uidInput) uidInput.value = getOrGenerateUID();
}

// --- Menu Toggle Logic ---
document.getElementById('btn-more-menu').addEventListener('click', () => {
  const panel = document.getElementById('more-menu-panel');
  panel.classList.toggle('hidden');
  updateUIDDisplay();
});

document.getElementById('btn-generate-uid').addEventListener('click', () => {
  const newUid = 'user_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('studyapp_uid', newUid);
  updateUIDDisplay();
});

document.getElementById('input-uid').addEventListener('change', (e) => {
  if (e.target.value.trim() !== '') {
    localStorage.setItem('studyapp_uid', e.target.value.trim());
  }
});

// --- Sync Engine (using Supabase Edge Function) ---
const SYNC_API_URL = `${SUPABASE_URL}/functions/v1/sync-api`;

function showStatus(message, isError = false) {
  const statusEl = document.getElementById('sync-status-msg');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ff4d4d' : '#4caf50';
    setTimeout(() => statusEl.textContent = '', 3000);
  }
}

async function pushSync() {
  const uid = getOrGenerateUID();
  const localData = localStorage.getItem('studyapp_log');
  
  showStatus("Syncing...");
  
  try {
    const response = await fetch(`${SYNC_API_URL}/${uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${uid}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        last_sync: new Date().toISOString(),
        data: localData ? JSON.parse(localData) : []
      })
    });

    if (!response.ok) throw new Error("Server rejected sync");
    showStatus("Cloud updated successfully!");

  } catch (error) {
    console.error("Sync Error:", error);
    showStatus("Sync failed. Check connection.", true);
  }
}

async function pullSync() {
  const uid = getOrGenerateUID();
  showStatus("Restoring...");

  try {
    const response = await fetch(`${SYNC_API_URL}/${uid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${uid}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!response.ok) throw new Error("No data found");
    
    const remoteData = await response.json();
    
    if (remoteData) {
      localStorage.setItem('studyapp_log', JSON.stringify(remoteData));
      window.dispatchEvent(new Event('tracker:update'));
      showStatus("Restored successfully!");
    }
  } catch (error) {
    console.error("Restore Error:", error);
    showStatus("Restore failed.", true);
  }
}


// Menu toggle


