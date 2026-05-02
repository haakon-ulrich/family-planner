import {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export interface WeatherCondition {
  Icon: React.ComponentType<LucideProps>;
  iconClass: string;
  label: string;
}

const CONDITIONS: Record<number, WeatherCondition> = {
  0:  { Icon: Sun,            iconClass: 'text-amber-400',  label: 'Sonnig' },
  1:  { Icon: Sun,            iconClass: 'text-amber-400',  label: 'Heiter' },
  2:  { Icon: CloudSun,       iconClass: 'text-amber-300',  label: 'Teilbewölkt' },
  3:  { Icon: Cloud,          iconClass: 'text-slate-400',  label: 'Bedeckt' },
  45: { Icon: Cloud,          iconClass: 'text-slate-500',  label: 'Neblig' },
  48: { Icon: Cloud,          iconClass: 'text-slate-500',  label: 'Neblig' },
  51: { Icon: CloudDrizzle,   iconClass: 'text-blue-300',   label: 'Nieselregen' },
  53: { Icon: CloudDrizzle,   iconClass: 'text-blue-400',   label: 'Nieselregen' },
  55: { Icon: CloudDrizzle,   iconClass: 'text-blue-400',   label: 'Nieselregen' },
  61: { Icon: CloudRain,      iconClass: 'text-blue-400',   label: 'Leichter Regen' },
  63: { Icon: CloudRain,      iconClass: 'text-blue-500',   label: 'Regen' },
  65: { Icon: CloudRain,      iconClass: 'text-blue-500',   label: 'Starker Regen' },
  71: { Icon: CloudSnow,      iconClass: 'text-slate-200',  label: 'Leichter Schnee' },
  73: { Icon: CloudSnow,      iconClass: 'text-slate-200',  label: 'Schnee' },
  75: { Icon: CloudSnow,      iconClass: 'text-white',      label: 'Starker Schnee' },
  77: { Icon: CloudSnow,      iconClass: 'text-slate-200',  label: 'Schnee' },
  80: { Icon: CloudRain,      iconClass: 'text-blue-400',   label: 'Schauer' },
  81: { Icon: CloudRain,      iconClass: 'text-blue-500',   label: 'Schauer' },
  82: { Icon: CloudRain,      iconClass: 'text-blue-500',   label: 'Starke Schauer' },
  85: { Icon: CloudSnow,      iconClass: 'text-slate-300',  label: 'Schneeschauer' },
  86: { Icon: CloudSnow,      iconClass: 'text-white',      label: 'Schneeschauer' },
  95: { Icon: CloudLightning, iconClass: 'text-yellow-400', label: 'Gewitter' },
  96: { Icon: CloudLightning, iconClass: 'text-yellow-400', label: 'Hagel' },
  99: { Icon: CloudLightning, iconClass: 'text-yellow-400', label: 'Hagel' },
};

const FALLBACK: WeatherCondition = { Icon: Cloud, iconClass: 'text-slate-400', label: 'Unbekannt' };

export const getWeatherCondition = (code: number): WeatherCondition =>
  CONDITIONS[code] ?? FALLBACK;

export const GERMAN_DAY_LABELS: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa',
};

export const getDayLabel = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00`);
  return GERMAN_DAY_LABELS[d.getDay()] ?? '';
};
