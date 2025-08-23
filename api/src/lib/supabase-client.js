"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.isSupabaseConfigured = void 0;
exports.testConnection = testConnection;
exports.getDatabaseStats = getDatabaseStats;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = require("dotenv");
// Load environment variables first
dotenv.config();
/**
 * SUPABASE CLIENT FOR ACCELERATE PLATFORM
 * Connects to the Accelerate database to store qualified content
 */
// Get environment variables with fallbacks
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';
// Check if properly configured
exports.isSupabaseConfigured = !supabaseUrl.includes('placeholder') &&
    !supabaseKey.includes('placeholder');
if (!exports.isSupabaseConfigured) {
}
// Create Supabase client
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false, // Server-side, no need for session persistence
    },
    global: {
        headers: {
            'x-application': 'accelerate-content-automation',
        },
    },
});
/**
 * Test database connection
 */
async function testConnection() {
    if (!exports.isSupabaseConfigured) {
        return false;
    }
    try {
        const { error } = await exports.supabase
            .from('projects')
            .select('id')
            .limit(1);
        if (error) {
            return false;
        }
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Get database statistics
 */
async function getDatabaseStats() {
    const [projects, funding, resources] = await Promise.all([
        exports.supabase.from('projects').select('id', { count: 'exact', head: true }),
        exports.supabase.from('funding_programs').select('id', { count: 'exact', head: true }),
        exports.supabase.from('resources').select('id', { count: 'exact', head: true }),
    ]);
    return {
        projects: projects.count || 0,
        funding_programs: funding.count || 0,
        resources: resources.count || 0,
        total: (projects.count || 0) + (funding.count || 0) + (resources.count || 0),
    };
}
