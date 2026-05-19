import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import styles from './OtpInput.module.css';

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
}

export function OtpInput({ length = 6, onComplete, error, disabled }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const controls = useAnimation();

  useEffect(() => {
    if (error) {
      controls
        .start({ x: [-10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.45 } })
        .then(() => {
          setDigits(Array(length).fill(''));
          inputs.current[0]?.focus();
        });
    }
  }, [error, controls, length]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setAt = (i: number, v: string) => {
    setDigits((arr) => {
      const next = [...arr];
      next[i] = v.slice(-1).replace(/\D/g, '');
      // If complete, fire onComplete
      if (next.every((d) => d.length === 1)) {
        onComplete(next.join(''));
      }
      return next;
    });
  };

  const handleChange = (i: number, value: string) => {
    if (disabled) return;
    if (value.length > 1) {
      // User pasted multiple digits — distribute across boxes
      const chars = value.replace(/\D/g, '').slice(0, length - i).split('');
      setDigits((arr) => {
        const next = [...arr];
        chars.forEach((c, k) => {
          next[i + k] = c;
        });
        if (next.every((d) => d.length === 1)) onComplete(next.join(''));
        return next;
      });
      const focusIdx = Math.min(length - 1, i + chars.length);
      inputs.current[focusIdx]?.focus();
      return;
    }
    setAt(i, value);
    if (value && i < length - 1) inputs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, key: string) => {
    if (disabled) return;
    if (key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      setAt(i - 1, '');
    }
    if (key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
    if (key === 'ArrowRight' && i < length - 1) inputs.current[i + 1]?.focus();
  };

  return (
    <motion.div animate={controls} className={styles.row}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="tel"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length - i}
          disabled={disabled}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e.key)}
          onFocus={(e) => e.target.select()}
          className={`${styles.box} ${error ? styles.boxError : ''}`}
        />
      ))}
    </motion.div>
  );
}
