import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://yxizhqfkajznbdigfxho.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aXpocWZrYWp6bmJkaWdmeGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjkxMzcsImV4cCI6MjA5NjI0NTEzN30.LZxbHk2wdGKqDcMZQQaXeeXX-uEvzse6Gt6KDKzKnpA'
)
