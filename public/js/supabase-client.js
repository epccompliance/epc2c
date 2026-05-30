import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Paste your two PUBLIC values from Supabase:
// Dashboard -> Project Settings -> API (or "API Keys")
//   - Project URL          -> SUPABASE_URL
//   - anon / public key     -> SUPABASE_ANON_KEY  (a long string starting "eyJ..." or "sb_publishable_...")
// Both are safe to expose in the browser; Row Level Security protects your data.
// NEVER put the service_role / secret key in this file.

const SUPABASE_URL = 'https://qvtiqcdshdfkcogbrhso.supabase.co';        // e.g. https://abcd1234.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dGlxY2RzaGRma2NvZ2JyaHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTMzMjgsImV4cCI6MjA5NTY2OTMyOH0.57zbK4UBx3o9RTnFcJJkF_eqTB2hRjTXu9tNCFeGl74';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
