import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  emphasis?: 'none' | 'green' | 'red';
  padding?: number | string;
}

export function Card({
  children,
  emphasis = 'none',
  padding,
  className,
  style,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        styles.card,
        emphasis !== 'none' ? styles[emphasis] : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ padding, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
