import React, { useEffect, useState } from 'react';

type InfoCardProps = {
  title: string;
  subtitle?: string;
  value?: number | string;
  icon?: React.ReactNode;
  accent?: string;
  loading?: boolean;
  duration?: number;
};

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(progress * target));
      if (progress < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, subtitle, value, icon, accent = 'bg-indigo-500', loading = false, duration = 700 }) => {
  const isNumeric = typeof value === 'number';
  const numeric = isNumeric ? useCountUp(value as number, duration) : value;

  if (loading) {
    return (
      <div className="rounded-xl p-4 border bg-gradient-to-br from-white/60 to-white/30 animate-pulse">
        <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl shadow-sm hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 bg-gradient-to-br from-white/60 to-white/30 dark:from-gray-800 dark:to-gray-700 p-4 border">
      <div className="flex items-start gap-3">
        <div className={`${accent} p-2 rounded-md text-white`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500">{title}</div>
          <div className="mt-1 text-2xl font-semibold">{numeric}</div>
          {subtitle && <div className="text-sm text-gray-400 mt-1">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
};

export default InfoCard;
