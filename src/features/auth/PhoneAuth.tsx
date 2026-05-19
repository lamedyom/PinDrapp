import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronDown, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../stores/toastStore';
import { OtpInput } from './OtpInput';
import styles from './PhoneAuth.module.css';

interface Country {
  code: string;
  flag: string;
  dial: string;
}

const COUNTRIES: Country[] = [
  { code: 'US', flag: '🇺🇸', dial: '+1' },
  { code: 'CA', flag: '🇨🇦', dial: '+1' },
  { code: 'GB', flag: '🇬🇧', dial: '+44' },
  { code: 'IL', flag: '🇮🇱', dial: '+972' },
  { code: 'DE', flag: '🇩🇪', dial: '+49' },
  { code: 'FR', flag: '🇫🇷', dial: '+33' },
  { code: 'IN', flag: '🇮🇳', dial: '+91' },
  { code: 'AU', flag: '🇦🇺', dial: '+61' },
  { code: 'JP', flag: '🇯🇵', dial: '+81' },
  { code: 'BR', flag: '🇧🇷', dial: '+55' },
  { code: 'MX', flag: '🇲🇽', dial: '+52' },
];

function formatUSPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export function PhoneAuth() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Start countdown after sending OTP
  const startResendTimer = () => {
    setResendIn(30);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setResendIn((n) => {
        if (n <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  const fullPhone = `${country.dial}${digitsOnly(phone)}`;
  const phoneValid = digitsOnly(phone).length >= 7;

  const sendOtp = async () => {
    if (!phoneValid) return;
    if (!supabase) {
      showToast('Connect Supabase to enable phone sign-in');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setSubmitting(false);
    if (error) {
      showToast(`Couldn't send code — ${error.message}`);
      return;
    }
    setStep('otp');
    startResendTimer();
  };

  const verifyOtp = async (code: string) => {
    if (!supabase) return;
    setSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: code,
      type: 'sms',
    });
    setSubmitting(false);
    if (error) {
      setOtpError(true);
      window.setTimeout(() => setOtpError(false), 600);
      return;
    }
    // authStore.initialize listener will pick up the new session.
    navigate('/');
  };

  return (
    <div className={styles.screen}>
      <button
        type="button"
        className={styles.backBtn}
        onClick={() => (step === 'otp' ? setStep('phone') : navigate(-1))}
        aria-label="Back"
      >
        <ArrowLeft size={20} />
      </button>

      <AnimatePresence mode="wait">
        {step === 'phone' ? (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className={styles.body}
          >
            <div className={styles.heading}>
              <div className={styles.iconCircle}>
                <Phone size={20} />
              </div>
              <h1 className={styles.title}>What's your number?</h1>
              <p className={styles.sub}>We'll text you a code to verify.</p>
            </div>

            <div className={styles.phoneRow}>
              <button
                type="button"
                className={styles.countryBtn}
                onClick={() => setPickerOpen((v) => !v)}
                aria-expanded={pickerOpen}
              >
                <span className={styles.flag}>{country.flag}</span>
                <span>{country.dial}</span>
                <ChevronDown size={14} />
              </button>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(555) 555-5555"
                value={formatUSPhone(phone)}
                onChange={(e) => setPhone(e.target.value)}
                className={styles.phoneInput}
              />
            </div>

            {pickerOpen && (
              <div className={styles.countryList}>
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className={`${styles.countryItem} ${c.code === country.code ? styles.countryItemActive : ''}`}
                    onClick={() => {
                      setCountry(c);
                      setPickerOpen(false);
                    }}
                  >
                    <span className={styles.flag}>{c.flag}</span>
                    <span className={styles.countryName}>{c.code}</span>
                    <span className={styles.countryDial}>{c.dial}</span>
                  </button>
                ))}
              </div>
            )}

            <p className={styles.hint}>We'll send you a verification code</p>

            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!phoneValid || submitting}
              onClick={sendOtp}
            >
              {submitting ? 'Sending…' : 'Send Code'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className={styles.body}
          >
            <div className={styles.heading}>
              <h1 className={styles.title}>Enter the code</h1>
              <p className={styles.sub}>
                Sent to <strong>{country.dial} {formatUSPhone(phone)}</strong>
              </p>
            </div>

            <OtpInput onComplete={verifyOtp} error={otpError} disabled={submitting} />

            <button
              type="button"
              className={styles.linkBtn}
              disabled={resendIn > 0 || submitting}
              onClick={sendOtp}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
