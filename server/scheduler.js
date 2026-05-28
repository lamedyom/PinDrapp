// Scheduled-post worker (Pro AI Autopilot). Polls scheduled_posts every 60s
// and publishes any that are due, then notifies the business's followers.

async function notifyFollowers(supabase, businessId, dealData) {
  try {
    const { data: followers } = await supabase
      .from('followers')
      .select('users(id, push_token)')
      .eq('business_id', businessId);
    // Push delivery (Expo / web push) is wired in when push tokens are added.
    // For now this is a no-op beyond logging the audience size.
    if (followers && followers.length) {
      console.log(
        `[scheduler] would notify ${followers.length} follower(s) of new deal "${dealData.headline}"`,
      );
    }
  } catch (err) {
    console.error('[scheduler] notifyFollowers failed:', err.message);
  }
}

async function processDuePosts(supabase) {
  const nowIso = new Date().toISOString();
  const { data: duePosts, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso);
  if (error) {
    console.error('[scheduler] query failed:', error.message);
    return;
  }
  for (const scheduled of duePosts || []) {
    try {
      await supabase.from('deals').insert({
        ...scheduled.deal_data,
        media_url: scheduled.image_url,
        media_type: 'image',
        is_active: true,
        created_at: new Date().toISOString(),
      });
      await supabase
        .from('scheduled_posts')
        .update({ status: 'posted' })
        .eq('id', scheduled.id);
      await notifyFollowers(supabase, scheduled.business_id, scheduled.deal_data);
    } catch (err) {
      console.error('[scheduler] failed to post scheduled deal:', err.message);
    }
  }
}

function startScheduler(supabase) {
  if (!supabase) {
    console.warn('[scheduler] Supabase not configured — scheduler disabled');
    return;
  }
  console.log('[scheduler] started — checking scheduled_posts every 60s');
  setInterval(() => {
    processDuePosts(supabase).catch((e) => console.error('[scheduler] tick error:', e.message));
  }, 60000);
}

module.exports = { startScheduler, processDuePosts };
