// Radar AI search endpoint — Claude interprets the user's query against the
// live businesses + active deals tables and returns a friendly message plus
// the matched business ids. Falls back to a deterministic mock if Claude
// isn't configured so the client UI always gets a usable response.
const express = require('express');

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function emojiForCategory(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('pizza') || c.includes('italian')) return '🍕';
  if (c.includes('steak') || c.includes('food') || c.includes('restaurant')) return '🍽️';
  if (c.includes('coffee')) return '☕';
  if (c.includes('bakery')) return '🥐';
  if (c.includes('vegan') || c.includes('green') || c.includes('juice')) return '🥗';
  if (c.includes('fashion') || c.includes('boutique')) return '👗';
  if (c.includes('jewelry')) return '💎';
  if (c.includes('wine')) return '🍷';
  if (c.includes('book')) return '📚';
  if (c.includes('tech') || c.includes('electronics')) return '📱';
  return '📍';
}

function haversine(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 0.621371;
}

async function loadContext(supabase) {
  const [bizRes, dealsRes] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, category, address, bio, lat, lng, avatar_url')
      .limit(40),
    supabase
      .from('deals')
      .select('id, business_id, headline, expires_at, is_active, businesses(name, category)')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .limit(20),
  ]);
  return {
    businesses: bizRes.data || [],
    deals: dealsRes.data || [],
  };
}

function buildResults(businesses, deals, matchedIds, near) {
  const dealByBiz = new Map();
  for (const d of deals) dealByBiz.set(d.business_id, d);
  return businesses
    .filter((b) => matchedIds.includes(b.id))
    .map((b) => {
      const deal = dealByBiz.get(b.id);
      return {
        id: b.id,
        name: b.name,
        category: b.category,
        address: b.address || null,
        distanceMiles:
          near && b.lat != null && b.lng != null ? haversine(near, b) : null,
        emoji: emojiForCategory(b.category),
        avatarUrl: b.avatar_url || null,
        hasActiveDeal: !!deal,
        dealHeadline: deal ? deal.headline : null,
        lat: b.lat,
        lng: b.lng,
      };
    });
}

function mockResults(query, businesses, deals, near) {
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const dealsBoost = /(deal|sale|offer)/.test(query.toLowerCase());
  const dealByBiz = new Map();
  for (const d of deals) dealByBiz.set(d.business_id, d);
  const scored = businesses
    .map((b) => {
      const name = (b.name || '').toLowerCase();
      const cat = (b.category || '').toLowerCase();
      const score =
        tokens.reduce(
          (acc, t) => acc + (name.includes(t) ? 2 : cat.includes(t) ? 1 : 0),
          0,
        ) + (dealsBoost && dealByBiz.has(b.id) ? 3 : 0);
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const matched = scored.map((x) => x.b.id);
  const results = buildResults(businesses, deals, matched, near);
  const message =
    results.length === 0
      ? "I didn't find any matches on Pindrapp yet. Try a broader term."
      : `Found ${results.length} match${results.length === 1 ? '' : 'es'} near you.`;
  return { message, businesses: results };
}

module.exports = function radarRoutes({ supabase, anthropic }) {
  const router = express.Router();

  router.post('/search', async (req, res) => {
    const { query, userLat, userLng } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query required' });
    }
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase is not configured on the server' });
    }
    const near = userLat != null && userLng != null ? { lat: userLat, lng: userLng } : null;
    try {
      const { businesses, deals } = await loadContext(supabase);
      // Fall back to keyword search if Claude isn't wired.
      if (!anthropic) {
        return res.json(mockResults(query, businesses, deals, near));
      }

      const prompt =
        `You are Radar, a friendly local discovery assistant for the Pindrapp app.\n` +
        `User is searching for: "${query}"\n` +
        `User location: ${near ? `${near.lat},${near.lng}` : 'unknown'}\n\n` +
        `Available businesses on Pindrapp:\n` +
        businesses
          .map((b) => `- id=${b.id} ${b.name} (${b.category})${b.address ? ` · ${b.address}` : ''}`)
          .join('\n') +
        `\n\nActive deals right now:\n` +
        deals
          .map(
            (d) =>
              `- ${d.businesses ? d.businesses.name : d.business_id}: ${d.headline} (business_id=${d.business_id})`,
          )
          .join('\n') +
        `\n\nGive a friendly 1–2 sentence response pointing the user to the best matches. ` +
        `End your message with a JSON object on its own line: ` +
        `{"matches": ["business_id_1", "business_id_2"]}\n` +
        `Use the exact ids from the businesses list above. If nothing fits, return an empty matches array.`;

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = (response.content.find((c) => c.type === 'text') || {}).text || '{}';
      const jsonStart = text.lastIndexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      let matched = [];
      let message = text;
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        try {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
          if (Array.isArray(parsed.matches)) matched = parsed.matches;
          message = text.slice(0, jsonStart).trim();
        } catch {
          /* keep the full text as the message */
        }
      }

      res.json({ message, businesses: buildResults(businesses, deals, matched, near) });
    } catch (err) {
      console.error('[radar] search error:', err);
      res.status(500).json({ error: err.message || 'Radar search failed' });
    }
  });

  return router;
};
