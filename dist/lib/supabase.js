"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasPlaceholderSupabaseConfig = !supabaseUrl ||
    !supabaseServiceKey ||
    supabaseUrl.includes('your-project.supabase.co') ||
    supabaseServiceKey.includes('your-service-role-key') ||
    supabaseServiceKey.includes('test-service-role-key');
if (hasPlaceholderSupabaseConfig) {
    throw new Error('Missing or placeholder Supabase configuration. Set real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values in backend/.env before starting the app.');
}
// We use the service role key to bypass RLS and manage users from the backend.
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
