import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Apple, Minus, Plus, X } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useDealStore } from '../../stores/dealStore';
import { hasStripeKey } from '../../lib/stripe';
import { createPaymentIntent } from '../../lib/api';
import { showToast } from '../../stores/toastStore';
import styles from './CheckoutModal.module.css';

export function CheckoutModal() {
  const open = useDealStore((s) => s.checkoutOpen);
  const dealId = useDealStore((s) => s.checkoutDealId);
  const deals = useDealStore((s) => s.deals);
  const qty = useDealStore((s) => s.checkoutQuantity);
  const status = useDealStore((s) => s.checkoutStatus);
  const error = useDealStore((s) => s.checkoutError);
  const setQuantity = useDealStore((s) => s.setQuantity);
  const closeCheckout = useDealStore((s) => s.closeCheckout);
  const processPayment = useDealStore((s) => s.processPayment);

  const stripe = useStripe();
  const elements = useElements();
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeProcessing, setStripeProcessing] = useState(false);

  const deal = useMemo(() => deals.find((d) => d.id === dealId) ?? null, [deals, dealId]);

  useEffect(() => {
    if (status === 'success') {
      const t = window.setTimeout(() => {
        closeCheckout();
        showToast('Deal claimed — saved to your map');
      }, 3000);
      return () => window.clearTimeout(t);
    }
  }, [status, closeCheckout]);

  if (!deal) {
    return <Modal open={open} onClose={closeCheckout} />;
  }

  const unitPrice =
    deal.dealPrice ?? (deal.discountPercent ? 0 : deal.originalPrice ?? 0);
  const total = unitPrice * qty;
  const supportsApplePay =
    typeof window !== 'undefined' &&
    'ApplePaySession' in window &&
    (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } })
      .ApplePaySession?.canMakePayments?.();

  const handlePay = async () => {
    setStripeError(null);

    if (hasStripeKey() && stripe && elements) {
      setStripeProcessing(true);
      try {
        const card = elements.getElement(CardElement);
        if (!card) throw new Error('Card element not ready');
        const { clientSecret } = await createPaymentIntent({
          amount: total > 0 ? total : 1,
          currency: 'usd',
          dealId: deal.id,
        });
        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card },
        });
        if (result.error) throw new Error(result.error.message ?? 'Payment failed');
        await processPayment();
      } catch (e) {
        setStripeError(e instanceof Error ? e.message : 'Payment failed');
      } finally {
        setStripeProcessing(false);
      }
      return;
    }

    // Mock flow
    await processPayment();
  };

  return (
    <Modal open={open} onClose={closeCheckout} label="Checkout">
      <div className={styles.host}>
        <button
          type="button"
          className={styles.close}
          onClick={closeCheckout}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <AnimatePresence mode="wait">
          {status === 'loading' && (
            <motion.div
              key="loading"
              className={styles.state}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.progressBar}>
                <motion.div
                  className={styles.progressFill}
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                />
              </div>
              <p className={styles.stateText}>Processing your payment…</p>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              className={styles.successState}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <svg className={styles.check} viewBox="0 0 64 64" width="64" height="64">
                <motion.circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#00D97E"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5 }}
                />
                <motion.path
                  d="M20 33 L29 42 L45 24"
                  fill="none"
                  stroke="#00D97E"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                />
              </svg>
              <h3 className={styles.successTitle}>Deal Claimed! 🎉</h3>
              <p className={styles.successSub}>Saved to your map automatically</p>
            </motion.div>
          )}

          {(status === 'idle' || status === 'error') && (
            <motion.div
              key="idle"
              className={styles.body}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <section className={styles.summary}>
                <div className={styles.summaryEmoji}>{deal.emoji}</div>
                <div className={styles.summaryCopy}>
                  <div className={styles.summaryBiz}>{deal.businessName}</div>
                  <div className={styles.summaryHeadline}>{deal.headline}</div>
                  {unitPrice > 0 && (
                    <div className={styles.summaryPrice}>${unitPrice.toFixed(2)} each</div>
                  )}
                </div>
              </section>

              <section className={styles.qtyRow}>
                <div className={styles.qtyControl}>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => setQuantity(qty - 1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <span className={styles.qtyValue}>{qty}</span>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => setQuantity(qty + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className={styles.total}>
                  Order Total: <span>${total.toFixed(2)}</span>
                </div>
              </section>

              <div className={styles.divider} />

              {supportsApplePay && (
                <>
                  <button type="button" className={styles.applePay}>
                    <Apple size={16} />
                    Pay with Apple Pay
                  </button>
                  <div className={styles.orRow}>
                    <span /> or pay with card <span />
                  </div>
                </>
              )}

              {hasStripeKey() ? (
                <div className={styles.cardField}>
                  <label className={styles.label}>Card details</label>
                  <div className={styles.cardWrap}>
                    <CardElement
                      options={{
                        style: {
                          base: {
                            fontSize: '14px',
                            color: '#F0EFEA',
                            fontFamily: 'DM Sans, sans-serif',
                            '::placeholder': { color: 'rgba(240,239,234,0.45)' },
                            backgroundColor: '#18181F',
                          },
                          invalid: { color: '#FF3A3A' },
                        },
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className={styles.mockFields}>
                  <label className={styles.label}>
                    Card number
                    <input
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      className={styles.input}
                    />
                  </label>
                  <div className={styles.fieldRow}>
                    <label className={styles.label}>
                      Expiry
                      <input type="text" placeholder="MM/YY" className={styles.input} />
                    </label>
                    <label className={styles.label}>
                      CVC
                      <input type="text" placeholder="123" className={styles.input} />
                    </label>
                  </div>
                  <p className={styles.mockHint}>
                    Stripe key not configured — payment will simulate.
                  </p>
                </div>
              )}

              {(error || stripeError) && (
                <div className={styles.errorBox}>{error ?? stripeError}</div>
              )}

              <Button
                fullWidth
                variant="deal"
                size="lg"
                onClick={handlePay}
                disabled={stripeProcessing}
              >
                {stripeProcessing ? 'Processing…' : 'Complete Purchase'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
