// Pindrapp Pro subscription endpoints (Stripe). Creates a 7-day trial
// subscription and keeps businesses.is_pro in sync via webhooks.
const express = require('express');

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function registerSubscriptionRoutes(app, { stripe, supabase }) {
  // ── Stripe webhook (must receive the raw body, so it's registered with its
  // own raw parser BEFORE the global express.json() in index.js).
  app.post('/api/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    if (!stripe || !supabase) return res.status(503).send('not configured');
    let event;
    try {
      event = WEBHOOK_SECRET
        ? stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], WEBHOOK_SECRET)
        : JSON.parse(req.body.toString());
    } catch (err) {
      console.error('[stripe] webhook signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'customer.subscription.deleted':
        case 'customer.subscription.paused':
          await supabase
            .from('businesses')
            .update({ is_pro: false })
            .eq('stripe_subscription_id', event.data.object.id);
          break;
        case 'customer.subscription.resumed':
          await supabase
            .from('businesses')
            .update({ is_pro: true })
            .eq('stripe_subscription_id', event.data.object.id);
          break;
        case 'invoice.payment_succeeded':
          if (event.data.object.subscription) {
            await supabase
              .from('businesses')
              .update({ is_pro: true })
              .eq('stripe_subscription_id', event.data.object.subscription);
          }
          break;
        case 'invoice.payment_failed':
          // Grace period: warn the customer, downgrade after 3 days (handled by
          // a separate dunning job). No immediate downgrade here.
          console.warn('[stripe] payment failed for', event.data.object.subscription);
          break;
        default:
          break;
      }
      res.json({ received: true });
    } catch (err) {
      console.error('[stripe] webhook handler error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  const router = express.Router();

  router.post('/create-subscription', async (req, res) => {
    if (!stripe || !supabase) {
      return res.status(503).json({ error: 'Subscriptions are not configured on the server' });
    }
    if (!PRO_PRICE_ID) {
      return res.status(503).json({ error: 'STRIPE_PRO_PRICE_ID is not set' });
    }
    try {
      const { businessId, paymentMethodId } = req.body;
      if (!businessId) return res.status(400).json({ error: 'businessId required' });

      const { data: business } = await supabase
        .from('businesses')
        .select('*, users(id)')
        .eq('id', businessId)
        .single();
      if (!business) return res.status(404).json({ error: 'Business not found' });

      // Create or reuse the Stripe customer.
      let customerId = business.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: business.name,
          metadata: { businessId },
        });
        customerId = customer.id;
        await supabase
          .from('businesses')
          .update({ stripe_customer_id: customerId })
          .eq('id', businessId);
      }

      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      }

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: PRO_PRICE_ID }],
        trial_period_days: 7,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: { businessId },
      });

      // Flip to Pro immediately for the trial window.
      await supabase
        .from('businesses')
        .update({
          is_pro: true,
          pro_since: new Date().toISOString(),
          stripe_subscription_id: subscription.id,
        })
        .eq('id', businessId);

      res.json({
        subscriptionId: subscription.id,
        trialEnd: subscription.trial_end,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret ?? null,
      });
    } catch (err) {
      console.error('[stripe] create-subscription error:', err);
      res.status(400).json({ error: err.message || 'Subscription error' });
    }
  });

  app.use('/api', router);
}

module.exports = { registerSubscriptionRoutes };
