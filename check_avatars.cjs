const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ysczoqyhcmlcvycbvgez.supabase.co',
  'sb_publishable_cZNPvqAA2K3U2SvV7vzgEQ_cwZiq-zQ'
);

async function main() {
  // Check profiles that have yoyoyo or any username
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .limit(10);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  for (const p of data) {
    console.log(`Name: ${p.full_name} | avatar_url: ${p.avatar_url === null ? 'NULL' : p.avatar_url === '' ? 'EMPTY' : p.avatar_url.substring(0, 60) + '...'}`);
  }
}

main().catch(console.error);
