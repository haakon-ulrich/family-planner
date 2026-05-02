import { Cloud, RefreshCw } from 'lucide-react';
import WeatherDay from './WeatherDay';
import {
  useWeather,
  useRefreshWeather,
  getWeatherCondition,
  getDayLabel,
} from '@web/features/weather';

const WeatherSection = () => {
  const { data: weather } = useWeather();
  const refresh = useRefreshWeather();

  const current = weather ? getWeatherCondition(weather.currentWeatherCode) : null;

  return (
    <div className="border-b border-slate-700/50">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <Cloud className="w-5 h-5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Wetter
          </span>
        </div>
        <button onClick={refresh}>
          <RefreshCw className="w-5 h-5 text-slate-500 hover:text-white transition-colors" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-5">
        {weather && current ? (
          <>
            {/* Current conditions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <current.Icon className={`w-12 h-12 ${current.iconClass}`} strokeWidth={1.25} />
                <span className="text-5xl font-thin text-white tracking-tight">
                  {Math.round(weather.currentTemp)}°
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-200">{current.label}</p>
                <p className="text-xs text-slate-500 mt-1">
                  H:&nbsp;{Math.round(weather.todayHigh)}°&nbsp;&nbsp;T:&nbsp;
                  {Math.round(weather.todayLow)}°
                </p>
              </div>
            </div>

            {/* 4-day forecast */}
            <div className="flex justify-between pt-3 border-t border-slate-700/40 px-5">
              {weather.forecast.map((day) => {
                const cond = getWeatherCondition(day.weatherCode);
                return (
                  <WeatherDay
                    key={day.date}
                    label={getDayLabel(day.date)}
                    Icon={cond.Icon}
                    iconClass={cond.iconClass}
                    high={Math.round(day.high)}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 text-center py-2">Keine Wetterdaten</p>
        )}
      </div>
    </div>
  );
};

export default WeatherSection;
