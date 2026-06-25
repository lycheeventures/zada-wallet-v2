import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://kabjxgfdhszeninntlto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthYmp4Z2ZkaHN6ZW5pbm50bHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNzk4MDUsImV4cCI6MjA2MDc1NTgwNX0.1ynyjq_lnPcfZOOd4nVv4Z-jCy8pdDVMPmCye6pZmvo'
)