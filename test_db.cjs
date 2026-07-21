const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, l) => {
  const parts = l.split('=');
  if(parts.length >= 2) {
    acc[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
supabase.from('tasks').select('id, title, posted_by, poster:profiles!tasks_posted_by_fkey(full_name, avatar_url)').eq('title', 'Manglaba').then(({data, error}) => console.log('DATA:', JSON.stringify(data[0].poster, null, 2), 'ERROR:', error));
