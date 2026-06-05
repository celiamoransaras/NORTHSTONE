import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yxizhqfkajznbdigfxho.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aXpocWZrYWp6bmJkaWdmeGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjkxMzcsImV4cCI6MjA5NjI0NTEzN30.LZxbHk2wdGKqDcMZQQaXeeXX-uEvzse6Gt6KDKzKnpA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
