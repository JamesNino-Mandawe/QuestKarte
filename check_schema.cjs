const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ysczoqyhcmlcvycbvgez.supabase.co',
  'sb_publishable_cZNPvqAA2K3U2SvV7vzgEQ_cwZiq-zQ'
);

async function main() {
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  if (error) {
    console.error('Error fetching tasks:', error.message);
  } else {
    console.log('Task columns:', Object.keys(data[0] || {}).join(', '));
  }
}

main().catch(console.error);
