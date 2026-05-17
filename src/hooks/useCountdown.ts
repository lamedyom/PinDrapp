import { useEffect, useRef, useState } from 'react';
import { differenceInSeconds } from 'date-fns';

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  totalSecondsLeft: number;
  isExpired: boolean;
}

function compute(target: Date): Countdown {
  const totalSecondsLeft = Math.max(0, differenceInSeconds(target, new Date()));
  const hours = Math.floor(totalSecondsLeft / 3600);
  const minutes = Math.floor((totalSecondsLeft % 3600) / 60);
  const seconds = totalSecondsLeft % 60;
  return {
    hours,
    minutes,
    seconds,
    totalSecondsLeft,
    isExpired: totalSecondsLeft === 0,
  };
}

export function useCountdown(targetDate: Date): Countdown {
  // Stable timestamp dependency so callers can pass a fresh Date each render without looping.
  const ts = targetDate.getTime();
  const targetRef = useRef<Date>(targetDate);
  targetRef.current = targetDate;

  const [state, setState] = useState<Countdown>(() => compute(targetDate));

  useEffect(() => {
    setState(compute(targetRef.current));
    const id = window.setInterval(() => {
      const next = compute(targetRef.current);
      setState(next);
      if (next.isExpired) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [ts]);

  return state;
}
