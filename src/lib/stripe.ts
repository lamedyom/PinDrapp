import { loadStripe, type Stripe } from '@stripe/stripe-js';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const hasStripeKey = (): boolean =>
  !!PUBLISHABLE_KEY && !PUBLISHABLE_KEY.startsWith('your_');

export const stripePromise: Promise<Stripe | null> = hasStripeKey()
  ? loadStripe(PUBLISHABLE_KEY as string)
  : Promise.resolve(null);
