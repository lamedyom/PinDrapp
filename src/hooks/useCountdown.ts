import { useEffect, useState } from 'react';
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
  const [state, setState] = useState<Countdown>(() => compute(targetDate));

  useEffect(() => {
    setState(compute(targetDate));
    const id = window.setInterval(() => {
      const next = compute(targetDate);
      setState(next);
      if (next.isExpired) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetDate]);

  return state;
}
