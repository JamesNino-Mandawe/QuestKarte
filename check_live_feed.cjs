const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ysczoqyhcmlcvycbvgez.supabase.co',
  'sb_publishable_cZNPvqAA2K3U2SvV7vzgEQ_cwZiq-zQ'
);

async function main() {
  // Simulate exactly what MarketplaceFeedLive does
  const { data: taskData, error: taskError } = await supabase
    .from('tasks')
    .select('id,posted_by,title')
    .eq('status', 'open')
    .order('published_at', { ascending: false })
    .limit(3);

  if (taskError) {
    console.error('Task error:', taskError.message);
    return;
  }

  const memberIds = [...new Set(taskData.map(t => t.posted_by))];
  console.log('memberIds:', memberIds);

  const { data: memberData, error: memberError } = await supabase
    .from('profiles')
    .select('id,full_name,trust_factor,avatar_url')
    .in('id', memberIds);

  if (memberError) {
    console.error('Member error:', memberError.message);
    return;
  }

  for (const m of memberData) {
    console.log(`ID: ${m.id} | Name: ${m.full_name} | avatar_url: ${m.avatar_url ? m.avatar_url.substring(0, 40) + '...' : 'NULL/EMPTY'}`);
  }

  // Now check: does the Map lookup work?
  const members = new Map(memberData.map(m => [m.id, m]));
  for (const task of taskData) {
    const member = members.get(task.posted_by);
    console.log(`Task "${task.title}" | posterAvatar truthy: ${!!(member?.avatar_url)}`);
  }
}

main().catch(console.error);
