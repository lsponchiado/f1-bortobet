import { Thermometer, Droplets, CloudRain, Wind } from 'lucide-react';
import type { WeatherData } from '@/types/grid';

export function WeatherWidget({ weather }: { weather: WeatherData | null }) {
  if (!weather) return null;

  const items = [
    { icon: Thermometer, label: 'Ar', value: weather.airTemperature != null ? `${weather.airTemperature}°` : '--' },
    { icon: Thermometer, label: 'Pista', value: weather.trackTemperature != null ? `${weather.trackTemperature}°` : '--' },
    { icon: Droplets, label: 'Umid.', value: weather.humidity != null ? `${weather.humidity}%` : '--' },
    { icon: Wind, label: 'Vento', value: weather.windSpeed != null ? `${weather.windSpeed} km/h` : '--' },
  ];

  return (
    <div className="flex items-center justify-center gap-4 rounded-xl bg-[#1f1f27] border border-white/5 px-4 py-2">
      {weather.rainfall && (
        <div className="flex items-center gap-1 text-blue-400">
          <CloudRain size={14} />
          <span className="text-[10px] font-black uppercase">Chuva</span>
        </div>
      )}
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon size={12} className="text-gray-500" />
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-gray-500 leading-none">{label}</span>
            <span className="text-[11px] font-black text-white leading-tight">{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
