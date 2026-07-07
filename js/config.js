// js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://uzbzvscubbtcqdszkbjd.supabase.co' 
const supabaseKey = 'sb_publishable_rIfW308AwXxAHBV_M0UegA_mesIYfnS'

export const supabase = createClient(supabaseUrl, supabaseKey)

