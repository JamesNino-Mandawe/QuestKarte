const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ysczoqyhcmlcvycbvgez.supabase.co',
  'sb_publishable_cZNPvqAA2K3U2SvV7vzgEQ_cwZiq-zQ'
);

async function main() {
  // Check if conversations table has last_message_at
  const { data: d3, error: e3 } = await supabase
    .from('conversations')
    .select('id, last_message_at, updated_at, created_at')
    .limit(5);
  console.log('CONVERSATIONS ERROR:', e3?.message || 'none');
  console.log('CONVERSATIONS:', JSON.stringify(d3, null, 2));

  // Test the inner join query
  const { data, error } = await supabase
    .from('conversation_members')
    .select('last_read_at, conversations:conversations!inner(last_message_at)')
    .limit(5);
  console.log('INNER JOIN ERROR:', error?.message || 'none');
  console.log('INNER JOIN DATA:', JSON.stringify(data?.[0]));
}

main().catch(console.error);
