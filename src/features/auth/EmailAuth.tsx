import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../stores/toastStore';
import styles from './EmailAuth.module.css';

type Mode = 'signup' | 'login';

export function EmailAuth() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'login' ? 'login' : 'signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setError(null);
    setParams({ mode: next });
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validPw = password.length >= 6;
  const validConfirm = mode === 'login' || confirm === password;
  const canSubmit = validEmail && validPw && validConfirm && !submitting;

  const submit = async () => {
    if (!supabase) {
      showToast('Connect Supabase to enable email sign-in');
      return;
    }
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const { error: signupErr } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signupErr) throw signupErr;
        showToast('Check your inbox to confirm your email');
        navigate('/');
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginErr) throw loginErr;
        navigate('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReset = async () => {
    if (!supabase || !validEmail) return;
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (e) {
      setError(e.message);
    } else {
      showToast('Password reset email sent');
    }
  };

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">
        <ArrowLeft size={20} />
      </button>

      <div className={styles.body}>
        <div className={styles.iconCircle}>
          <Mail size={20} />
        </div>
        <h1 className={styles.title}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className={styles.sub}>
          {mode === 'signup'
            ? 'Use your email and a strong password.'
            : 'Log in to pick up where you left off.'}
        </p>

        <label className={styles.fieldLabel}>
          Email
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.fieldLabel}>
          Password
          <div className={styles.pwWrap}>
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
            />
            <button
              type="button"
              className={styles.pwToggle}
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {mode === 'signup' && (
          <label className={styles.fieldLabel}>
            Confirm password
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={styles.input}
            />
            {confirm.length > 0 && confirm !== password && (
              <span className={styles.fieldError}>Passwords don't match</span>
            )}
          </label>
        )}

        {mode === 'login' && (
          <button type="button" className={styles.forgotLink} onClick={sendReset}>
            Forgot password?
          </button>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!canSubmit}
          onClick={submit}
        >
          {submitting ? (mode === 'signup' ? 'Creating…' : 'Logging in…') : mode === 'signup' ? 'Create Account' : 'Log In'}
        </button>

        <div className={styles.swapRow}>
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button type="button" className={styles.swapLink} onClick={() => switchMode('login')}>
                Log in
              </button>
            </>
          ) : (
            <>
              New here?{' '}
              <button type="button" className={styles.swapLink} onClick={() => switchMode('signup')}>
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
