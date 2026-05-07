// www/auth.js
const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const ANON_KEY = 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp';

// Initialize the Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, ANON_KEY);

const Auth = {
    // ── Email/Password ──────────────────────────────────────────
    async signUp(email, password) {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
        else alert("Check your email for the confirmation link!");
    },

    async signIn(email, password) {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) alert("Login Failed: " + error.message);
        else this.checkSession();
    },

    // ── Google OAuth ──────────────────────────────────────────
    async signInWithGoogle() {
        const { error } = await _supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href }
        });
        if (error) console.error(error.message);
    },

    async signOut() {
        await _supabase.auth.signOut();
        localStorage.removeItem('user_sync_data');
        this.checkSession();
    },

    // ── UI Toggle Logic ──────────────────────────────────────────
    async checkSession() {
        const { data: { session } } = await _supabase.auth.getSession();
        const authSection = document.getElementById('auth-section');
        const syncControls = document.getElementById('sync-controls');
        const userDisplay = document.getElementById('user-email-display');

        if (session) {
            authSection.classList.add('hidden');
            syncControls.classList.remove('hidden');
            userDisplay.textContent = session.user.email;
            // Wake up the Sync Engine now that we have a user
            if (window.SyncEngine) window.SyncEngine.processQueue();
        } else {
            authSection.classList.remove('hidden');
            syncControls.classList.add('hidden');
        }
    }
};

// Check login status as soon as the script loads
Auth.checkSession();
