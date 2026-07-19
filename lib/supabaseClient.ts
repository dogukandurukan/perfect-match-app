import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fyqwjduzpnjuxqsloxih.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cXdqZHV6cG5qdXhxc2xveGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjQ2NjgsImV4cCI6MjA4ODc0MDY2OH0.Ko1MMTYTFnI4HW7ZMLqJnVKTg7-GjQOhfSx4kSQBm8k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
