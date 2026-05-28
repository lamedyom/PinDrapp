// AI Deal Autopilot endpoints (Pro only): Claude writes the deal, Replicate
// generates the image, the result is stored in the deal-images bucket.
const express = require('express');

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function getTimeReason(hour) {
  if (hour < 11) return 'Morning commuters are most active now';
  if (hour < 14) return 'Lunch rush — peak deal claiming time';
  if (hour < 17) return 'Afternoon browse — good for scheduling dinner deals';
  if (hour < 20) return 'Dinner rush — highest conversion time of day';
  return 'Late night — great for next-day early bird deals';
}

function partOfDay(hour) {
  if (hour < 11) return 'morning crowd';
  if (hour < 14) return 'lunch rush';
  if (hour < 17) return 'afternoon lull';
  if (hour < 20) return 'dinner rush';
  return 'late night';
}

async function runReplicate(replicate, { imagePrompt, referencePhoto }) {
  const input = {
    prompt:
      `${imagePrompt}, professional commercial photography, vibrant appetizing colors, ` +
      `clean background, suitable for a flash sale advertisement, high quality, sharp focus`,
    negative_prompt: 'blurry, low quality, watermark, text, logo, people, faces',
    width: 1080,
    height: 1080,
    num_outputs: 1,
    guidance_scale: 8,
    num_inference_steps: 35,
  };
  let model = 'stability-ai/sdxl';
  if (referencePhoto) {
    input.image = referencePhoto;
    input.prompt_strength = 0.7;
    model = 'stability-ai/sdxl-img2img';
  }
  const output = await replicate.run(model, { input });
  return Array.isArray(output) ? output[0] : output;
}

async function uploadGeneratedImage(supabase, businessId, imageUrl) {
  const resp = await fetch(imageUrl);
  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const path = `ai-generated/${businessId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('deal-images')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('deal-images').getPublicUrl(path);
  return data.publicUrl;
}

module.exports = function aiDealRoutes({ supabase, anthropic, replicate }) {
  const router = express.Router();

  const ready = !!(supabase && anthropic && replicate);

  router.post('/suggest-deal', async (req, res) => {
    if (!ready) {
      return res.status(503).json({ error: 'AI Autopilot is not configured on the server' });
    }
    try {
      const { businessId } = req.body;
      if (!businessId) return res.status(400).json({ error: 'businessId required' });

      // 1) Verify the business is Pro.
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      if (!business) return res.status(404).json({ error: 'Business not found' });
      if (!business.is_pro) {
        return res
          .status(403)
          .json({ error: 'upgrade_required', message: 'AI Autopilot requires Pindrapp Pro.' });
      }

      // 2) Gather context.
      const { data: catalog = [] } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_available', true);

      const { data: pastDeals = [] } = await supabase
        .from('deals')
        .select('headline, claim_count, view_count')
        .eq('business_id', businessId)
        .order('claim_count', { ascending: false })
        .limit(10);

      const { data: competitors = [] } = await supabase
        .from('businesses')
        .select('id, name, category')
        .eq('category', business.category)
        .neq('id', businessId)
        .limit(5);

      const competitorIds = competitors.map((c) => c.id);
      const { data: recentActivity = [] } = competitorIds.length
        ? await supabase
            .from('deals')
            .select('headline, claim_count, businesses(category)')
            .in('business_id', competitorIds)
            .eq('is_active', true)
        : { data: [] };

      const now = new Date();
      const hour = now.getHours();
      const dayName = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ][now.getDay()];

      const prompt = `You are an expert local business marketing strategist.

Business: ${business.name}
Type: ${business.category}
Location: ${business.address || 'local'}
Current time: ${hour}:00 on ${dayName}

THEIR CATALOG (${catalog.length} items):
${catalog
  .map(
    (i) =>
      `- ${i.name}: $${i.regular_price}${i.sale_price ? ` (was $${i.sale_price})` : ''} | Tags: ${(i.tags || []).join(', ') || 'none'} | id: ${i.id}`,
  )
  .join('\n')}

THEIR BEST PERFORMING PAST DEALS:
${pastDeals
  .slice(0, 5)
  .map((d) => `- "${d.headline}": ${d.claim_count || 0} claims, ${d.view_count || 0} views`)
  .join('\n')}

COMPETITOR DEALS ACTIVE RIGHT NOW:
${recentActivity
  .map((d) => `- ${d.businesses?.category}: "${d.headline}" (${d.claim_count || 0} claims)`)
  .join('\n')}

Based on all this data, suggest ONE flash deal that will:
1. Drive foot traffic TODAY at this specific time
2. Feature an item from their actual catalog
3. Be priced competitively but protect their margins
4. Stand out from what competitors are doing right now
5. Appeal to the most likely customer right now

Consider: ${partOfDay(hour)}

Respond ONLY with valid JSON, no other text:
{
  "catalog_item_id": "exact id from catalog",
  "catalog_item_name": "exact name from catalog",
  "headline": "compelling headline under 60 chars",
  "description": "one punchy sentence under 100 chars",
  "pricing_type": "fixed or percent",
  "original_price": 00.00,
  "deal_price": 00.00,
  "discount_percent": 00,
  "recommended_duration_hours": 2,
  "recommended_post_time_offset_minutes": 0,
  "reasoning": "2-3 sentences explaining why this deal right now",
  "image_prompt": "detailed prompt for generating an appetizing image of this item"
}`;

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find((c) => c.type === 'text')?.text || '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const suggestion = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

      // 3) Generate the image with Replicate, then store it.
      const catalogItem = catalog.find((i) => i.id === suggestion.catalog_item_id);
      const referencePhoto = catalogItem?.photo_url || null;
      let publicUrl = null;
      try {
        const replicateUrl = await runReplicate(replicate, {
          imagePrompt: suggestion.image_prompt,
          referencePhoto,
        });
        publicUrl = await uploadGeneratedImage(supabase, businessId, replicateUrl);
      } catch (imgErr) {
        console.error('[ai] image generation failed:', imgErr.message);
        publicUrl = referencePhoto; // fall back to the catalog photo
      }

      const postTime = new Date();
      postTime.setMinutes(
        postTime.getMinutes() + (suggestion.recommended_post_time_offset_minutes || 0),
      );

      res.json({
        suggestion,
        generatedImageUrl: publicUrl,
        catalogItemPhoto: referencePhoto,
        recommendedPostTime: postTime.toISOString(),
        postTimeReason: getTimeReason(hour),
      });
    } catch (err) {
      console.error('[ai] suggest-deal error:', err);
      res.status(500).json({ error: err.message || 'AI suggestion failed' });
    }
  });

  router.post('/regenerate-image', async (req, res) => {
    if (!ready) {
      return res.status(503).json({ error: 'AI Autopilot is not configured on the server' });
    }
    try {
      const { businessId, imagePrompt, catalogItemPhoto, regenerationCount = 0 } = req.body;
      if (regenerationCount >= 3) {
        return res.status(429).json({ error: 'Maximum regenerations reached (3)' });
      }
      const replicateUrl = await runReplicate(replicate, {
        imagePrompt,
        referencePhoto: catalogItemPhoto || null,
      });
      const publicUrl = await uploadGeneratedImage(supabase, businessId, replicateUrl);
      res.json({ generatedImageUrl: publicUrl });
    } catch (err) {
      console.error('[ai] regenerate-image error:', err);
      res.status(500).json({ error: err.message || 'Image regeneration failed' });
    }
  });

  return router;
};
