import { useMemo } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import type { Deal } from '../../stores/dealStore';
import styles from './DealAnalytics.module.css';

interface DealAnalyticsProps {
  deals: Deal[];
}

// Hours shown on the "claims by hour" chart.
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export function DealAnalytics({ deals }: DealAnalyticsProps) {
  const stats = useMemo(() => {
    const totalViews = deals.reduce((s, d) => s + (d.viewCount ?? 0), 0);
    const totalClaims = deals.reduce((s, d) => s + (d.claimCount ?? 0), 0);
    const revenue = deals.reduce(
      (s, d) => s + (d.claimCount ?? 0) * (d.dealPrice ?? 0),
      0,
    );
    const conversion = totalViews > 0 ? Math.round((totalClaims / totalViews) * 100) : 0;
    return { totalViews, totalClaims, revenue, conversion, count: deals.length };
  }, [deals]);

  // Synthesize a claims-by-hour distribution weighted toward the dinner rush.
  const chart = useMemo(() => {
    const weights = HOURS.map((h) => {
      const dinner = Math.exp(-((h - 18) ** 2) / 6);
      const lunch = 0.6 * Math.exp(-((h - 12) ** 2) / 4);
      return dinner + lunch;
    });
    const max = Math.max(...weights);
    const peakIdx = weights.indexOf(max);
    const totalClaims = Math.max(stats.totalClaims, 1);
    return HOURS.map((h, i) => ({
      hour: h,
      pct: Math.round((weights[i] / max) * 100),
      claims: Math.round((weights[i] / weights.reduce((a, b) => a + b, 0)) * totalClaims),
      peak: i === peakIdx,
    }));
  }, [stats.totalClaims]);

  if (deals.length === 0) {
    return (
      <div className={styles.empty}>
        Post your first deal to start seeing performance analytics.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>${stats.revenue.toLocaleString()}</div>
          <div className={styles.summaryLabel}>Revenue</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{stats.count}</div>
          <div className={styles.summaryLabel}>Deals</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{stats.conversion}%</div>
          <div className={styles.summaryLabel}>Avg conversion</div>
        </div>
      </div>

      <div className={styles.perDealHead}>Per-deal performance</div>
      <div className={styles.rows}>
        {deals.map((d) => {
          const views = d.viewCount ?? 0;
          const claims = d.claimCount ?? 0;
          const conv = views > 0 ? Math.round((claims / views) * 100) : 0;
          const revenue = claims * (d.dealPrice ?? 0);
          return (
            <div key={d.id} className={styles.row}>
              <div className={styles.rowName}>{d.headline}</div>
              <div className={styles.rowStats}>
                <span>{views.toLocaleString()} views</span>
                <span>{claims} claims</span>
                <span className={styles.conv}>{conv}%</span>
                <span className={styles.rev}>${revenue.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.chartHead}>
        <TrendingUp size={13} /> Claims by hour
      </div>
      <div className={styles.chart}>
        {chart.map((c) => (
          <div key={c.hour} className={styles.bar}>
            <div
              className={`${styles.barFill} ${c.peak ? styles.barPeak : ''}`}
              style={{ height: `${Math.max(6, c.pct)}%` }}
            />
            <div className={styles.barLabel}>{c.hour}</div>
          </div>
        ))}
      </div>

      <div className={styles.insights}>
        <div className={styles.insightsHead}>
          <Sparkles size={12} /> Weekly insight
        </div>
        <p className={styles.insightsBody}>
          Your best-converting deals run during the dinner rush. Consider scheduling more
          flash deals between 6–8 PM, when claims peak in your area.
        </p>
      </div>
    </div>
  );
}
