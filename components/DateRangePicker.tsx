import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  className = '',
  isOpen = false,
  onOpenChange
}) => {
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const d = new Date(startDate);
    return d;
  });

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const dateToString = (d: Date) => d.toISOString().slice(0, 10);
  const stringToDate = (s: string) => new Date(s + 'T00:00:00');

  const days = useMemo(() => {
    const total = daysInMonth(displayMonth);
    const first = firstDayOfMonth(displayMonth);
    const arr: (number | null)[] = Array(first).fill(null);
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  }, [displayMonth]);

  const handleDayClick = (day: number) => {
    const clickedDate = dateToString(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    );

    if (selecting === 'start') {
      setTempStart(clickedDate);
      setSelecting('end');
    } else {
      if (clickedDate >= tempStart) {
        setTempEnd(clickedDate);
        onChange(tempStart, clickedDate);
        onOpenChange?.(false);
        setSelecting('start');
      } else {
        setTempStart(clickedDate);
        setSelecting('end');
      }
    }
  };

  const handleShortcut = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const startStr = dateToString(start);
    const endStr = dateToString(end);
    setTempStart(startStr);
    setTempEnd(endStr);
    onChange(startStr, endStr);
    onOpenChange?.(false);
    setSelecting('start');
  };

  const monthName = displayMonth.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  const isInRange = (day: number) => {
    const dateStr = dateToString(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    );
    return dateStr >= tempStart && dateStr <= tempEnd;
  };

  const isStartDay = (day: number) => {
    const dateStr = dateToString(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    );
    return dateStr === tempStart;
  };

  const isEndDay = (day: number) => {
    const dateStr = dateToString(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    );
    return dateStr === tempEnd;
  };

  if (!isOpen) {
    const displayText =
      startDate === endDate
        ? new Date(startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : `${new Date(startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} → ${new Date(endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

    return (
      <button
        onClick={() => onOpenChange?.(true)}
        className={`flex items-center gap-2 px-3 py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors font-bold text-sm ${className}`}
      >
        <Calendar size={16} />
        {displayText}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={() => onOpenChange?.(false)} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
            {selecting === 'start' ? 'Selecione data inicial' : 'Selecione data final'}
          </h3>

          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                const prev = new Date(displayMonth);
                prev.setMonth(prev.getMonth() - 1);
                setDisplayMonth(prev);
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
            </button>

            <div className="text-sm font-bold text-slate-900 dark:text-white capitalize text-center flex-1">
              {monthName}
            </div>

            <button
              onClick={() => {
                const next = new Date(displayMonth);
                next.setMonth(next.getMonth() + 1);
                setDisplayMonth(next);
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <ChevronRight size={20} className="text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-3">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-xs font-bold text-center text-slate-500 dark:text-slate-400 h-8 flex items-center justify-center">
                {day}
              </div>
            ))}

            {days.map((day, idx) =>
              day === null ? (
                <div key={`empty-${idx}`} className="h-8" />
              ) : (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`h-8 text-xs font-bold rounded transition-colors ${
                    isStartDay(day) || isEndDay(day)
                      ? 'bg-indigo-600 text-white rounded-full'
                      : isInRange(day)
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-slate-900 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                </button>
              )
            )}
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 text-center mb-4">
            {tempStart === tempEnd
              ? new Date(tempStart).toLocaleDateString('pt-BR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
              : `${new Date(tempStart).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} → ${new Date(tempEnd).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}`}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleShortcut(0)}
            className="flex-1 px-2 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => handleShortcut(1)}
            className="flex-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Ontem
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onOpenChange?.(false)}
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onChange(tempStart, tempEnd);
              onOpenChange?.(false);
              setSelecting('start');
            }}
            className="flex-1 px-3 py-2 bg-indigo-600 rounded text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
