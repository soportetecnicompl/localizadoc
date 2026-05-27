import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Reemplaza estos valores con los de tu proyecto Supabase:
// Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://famwhmaznelnrfqwoqlj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbXdobWF6bmVsbnJmcXdvcWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDA5NTcsImV4cCI6MjA5NTQxNjk1N30.-d2H77TTmQHm03_Oh1t6bMUwkcZyPTHravwKonGa9Ug';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
