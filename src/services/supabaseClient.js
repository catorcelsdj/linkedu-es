import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
let validUrl = false
try { validUrl = ['http:', 'https:'].includes(new URL(url).protocol) } catch { /* Show configuration screen. */ }
export const isConfigured = validUrl && !!key && !/tu[-_]clave/.test(key) && !url.includes('tu-proyecto')
export const supabase = isConfigured ? createClient(url, key) : null
