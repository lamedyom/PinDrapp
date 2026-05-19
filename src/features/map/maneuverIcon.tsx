import {
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  MapPin,
  RotateCw,
} from 'lucide-react';
import type { RouteStep } from '../../lib/directions';

/** Maps a Mapbox maneuver to a Lucide icon component. */
export function maneuverIcon(step: RouteStep): typeof ArrowUp {
  const t = step.maneuverType;
  const m = step.maneuverModifier ?? '';
  if (t === 'depart') return MapPin;
  if (t === 'arrive') return Flag;
  if (t === 'roundabout' || t === 'rotary' || t === 'roundabout turn') return RotateCw;
  if (m.includes('uturn')) return RotateCw;
  if (m.includes('sharp left')) return CornerUpLeft;
  if (m.includes('sharp right')) return CornerUpRight;
  if (m.includes('slight left')) return ArrowUpLeft;
  if (m.includes('slight right')) return ArrowUpRight;
  if (m === 'left') return CornerDownLeft;
  if (m === 'right') return CornerDownRight;
  if (m === 'straight') return ArrowUp;
  if (t === 'continue') return ArrowUp;
  if (t === 'end of road') return ArrowDown;
  return ArrowUp;
}
