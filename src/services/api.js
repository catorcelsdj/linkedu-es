import { supabase } from './supabaseClient.js'
import { createApi } from './dataApi.js'
export const { projects, resources, people, messages, avatars, stats } = createApi(supabase)
