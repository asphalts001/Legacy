// www/auth.js
// Load this in index.html BEFORE tracker.js

const SUPABASE_URL = 'https://oscpkrgxjpsyoylxdpxg.supabase.co';
const ANON_KEY = 'sb_publishable_CNDbJZzUgXZAxLvp6_oBHg_FSsIWGWp';

// Initialize Supabase
const supabase = supabase.createClient(SUPABASE_URL, ANON_KEY);

const Auth = {
    async loginWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href }
        });
        if (error) console.error("Login Error:", error.message);
    },

    async loginWithEmail(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) alert(error.message);
        return data;
    },

    async logout() {
        await supabase.auth.signOut();
        localStorage.removeItem('user_sync_data');
        window.location.reload();
    }
};
