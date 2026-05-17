// Pindrapp Stripe payment intent server
// Run with: npm run dev:server (from project root)
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret || stripeSecret.startsWith('your_')) {
  console.warn('[server] STRIPE_SECRET_KEY missing — endpoints will return 503');
}

const stripe = stripeSecret && !stripeSecret.startsWith('your_') ? Stripe(stripeSecret) : null;

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, stripe: !!stripe });
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

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`[server] Pindrapp API listening on http://localhost:${port}`);
});
