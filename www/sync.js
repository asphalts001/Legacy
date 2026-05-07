/**
 * Block B: Sync Engine Implementation
 * Configured for project: oscpkrgxjpsyoylxdpxg
 */

const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const SYNC_API_URL = `${SUPABASE_URL}/functions/v1/sync-api`;

export const SyncEngine = {
  // ── Block A3: Local Store Operations ──────────────────────────────────────

  async saveAndSync(payload) {
    const snapshot = {
      ...payload,
      timestamp: Date.now(),
      status: 'pending'
    };

    const localData = this.getLocalData();
    localData.push(snapshot);
    localStorage.setItem('user_sync_data', JSON.stringify(localData));

    return this.processQueue();
  },

  getLocalData() {
    const data = localStorage.getItem('user_sync_data');
    return data ? JSON.parse(data) : [];
  },

  // ── Block B3 & B4: Queue Processing & Push ───────────────────────────────

  async processQueue() {
    if (!navigator.onLine) {
      console.warn('Sync Engine: Device Offline (G6)');
      return { success: false, mode: 'degraded' };
    }

    const localData = this.getLocalData();
    const pendingData = localData.filter(item => item.status !== 'synced');

    if (pendingData.length === 0) {
      return { success: true };
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No active session found');
      }

      const response = await fetch(SYNC_API_URL, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp'
        },
        body: JSON.stringify({ data: pendingData })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server Error: ${response.status}`);
      }

      const result = await response.json();
      this.markPendingAsSynced();

      return {
        success: true,
        total: result.total
      };
    } catch (error) {
      console.error('Sync Engine Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // ── Block D1: State Management ──────────────────────────────────────────

  markPendingAsSynced() {
    const syncedData = this.getLocalData().map(item =>
      item.status === 'synced'
        ? item
        : { ...item, status: 'synced' }
    );

    localStorage.setItem('user_sync_data', JSON.stringify(syncedData));
  },

  async pullFromServer() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No active session found');
      }

      const response = await fetch(SYNC_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp'
        }
      });

      if (!response.ok) {
        throw new Error(`Pull failed: ${response.status}`);
      }

      const serverData = await response.json();
      localStorage.setItem('user_sync_data', JSON.stringify(serverData));
      return serverData;
    } catch (error) {
      console.error('Pull Failed:', error.message);
      return null;
    }
  },

  async getAuthToken() {
    const key = 'sb-oscpkrgxjpsyoylxdpxg-auth-token';
    const sessionData = localStorage.getItem(key);

    if (!sessionData) {
      return null;
    }

    try {
      const parsed = JSON.parse(sessionData);
      return parsed.access_token || parsed.currentSession?.access_token || null;
    } catch {
      return null;
    }
  }
};

// ── Block F1: Automatic Heartbeat (60s) ────────────────────────────────────

function runHeartbeat() {
  if (navigator.onLine) {
    SyncEngine.processQueue().catch(() => {});
  }
}

setInterval(runHeartbeat, 60000);

// ── Bridge to Global Scope ────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.SyncEngine = SyncEngine;

  window.addEventListener('load', () => {
    setTimeout(runHeartbeat, 5000);
  });
}
