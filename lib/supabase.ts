import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// BoxUp Sales database. These two values are public by design (the anon key is safe to ship in the app;
// access is enforced by row-level security). They are fixed here so a stray environment variable on
// the build machine can never point this app at a different project.
const supabaseUrl = 'https://hfohhcsmeiqcmluwxhol.supabase.co'
const supabaseAnonKey = 'sb_publishable_cBi4dx0Q3SfG1FDFrDuN-g_wHbKCwn7'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
