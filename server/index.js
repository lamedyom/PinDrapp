// Pindrapp API server: Stripe payments + Pro subscriptions + AI Deal Autopilot.
// Run with: npm run dev:server (from project root)
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

const { registerSubscriptionRoutes } = require('./subscription');
const aiDealRoutes = require('./aiDeal');
const { startScheduler } = require('./scheduler');

// ── Stripe
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret || stripeSecret.startsWith('your_')) {
  console.warn('[server] STRIPE_SECRET_KEY missing — payment endpoints will return 503');
}
const stripe = stripeSecret && !stripeSecret.startsWith('your_') ? Stripe(stripeSecret) : null;

// ── Supabase (service role — server-side writes bypass RLS)
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (supabaseUrl && serviceKey) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
} else {
  console.warn('[server] SUPABASE_SERVICE_ROLE_KEY missing — AI/subscription endpoints limited');
}

// ── Anthropic (Claude) + Replicate for AI Autopilot
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('your_')) {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
let replicate = null;
if (process.env.REPLICATE_API_TOKEN && !process.env.REPLICATE_API_TOKEN.startsWith('your_')) {
  const Replicate = require('replicate');
  replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
}

const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));

// The Stripe webhook needs the raw body, so register subscription routes
// (which mount /api/webhook with a raw parser) BEFORE the global JSON parser.
registerSubscriptionRoutes(app, { stripe, supabase });

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    stripe: !!stripe,
    supabase: !!supabase,
    ai: !!(anthropic && replicate),
  });
});

app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured on the server' });
  }
  try {
    const { amount, currency = 'usd', dealId } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: { dealId: String(dealId ?? '') },
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error';
    res.status(400).json({ error: message });
  }
});

// AI Deal Autopilot
app.use('/api/ai', aiDealRoutes({ supabase, anthropic, replicate }));

// Background worker that publishes scheduled (AI-scheduled) deals.
startScheduler(supabase);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`[server] Pindrapp API listening on http://localhost:${port}`);
});
