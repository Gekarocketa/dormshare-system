import React, { useEffect, useState } from 'react';
import { api } from '../api';

const DAYS_AHEAD = 7;

function shiftDate(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDayLabels(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const weekday = d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '');
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    dayNumber: day,
    month: d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', ''),
  };
}

/**
 * Tygodniowy pasek wyboru dnia nad grafikiem pralni.
 * Pokazuje 7 kolejnych dni (od dziś) z liczbą wolnych terminów
 * oraz znacznikiem dni, w których mieszkaniec ma własną rezerwację.
 */
export default function WeekStrip({ todayStr, selectedDate, onSelectDate, isSlotPast, syncVersion }) {
  const [days, setDays] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => shiftDate(todayStr, i));

    Promise.all(dates.map((date) => api.getLaundrySlots(date)))
      .then((responses) => {
        if (cancelled) return;
        setDays(
          responses.map((res, i) => {
            const date = dates[i];
            const working = res.washingMachines.filter((m) => m.status === 'AVAILABLE');
            let free = 0;
            let total = 0;
            res.timeSlots.forEach((slot) => {
              if (isSlotPast?.(date, slot)) return;
              working.forEach((machine) => {
                total += 1;
                const taken = res.bookings.some(
                  (b) => b.resource_id === machine.id && b.time_slot === slot
                );
                if (!taken) free += 1;
              });
            });
            const hasOwnBooking = res.bookings.some((b) => b.user_id === res.currentUser?.id);
            return { date, free, total, hasOwnBooking };
          })
        );
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });

    return () => {
      cancelled = true;
    };
  }, [todayStr, syncVersion, isSlotPast]);

  if (days.length === 0) return null;

  return (
    <div className="px-3 sm:px-5 pt-3.5 pb-1 bg-white border-b border-slate-200">
      <div
        role="tablist"
        aria-label="Wybór dnia w tym tygodniu"
        className="flex sm:grid sm:grid-cols-7 gap-2 overflow-x-auto pb-2.5 -mx-1 px-1 snap-x"
      >
        {days.map(({ date, free, total, hasOwnBooking }) => {
          const { weekday, dayNumber, month } = getDayLabels(date);
          const isSelected = date === selectedDate;
          const isToday = date === todayStr;
          const isFull = total > 0 && free === 0;

          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={`${weekday} ${dayNumber} ${month}: ${free} wolnych terminów${
                hasOwnBooking ? ', masz rezerwację' : ''
              }`}
              onClick={() => onSelectDate(date)}
              className={`interactive-lift relative snap-start shrink-0 min-w-[76px] sm:min-w-0 rounded-[12px] border px-2 py-2 text-center ${
                isSelected
                  ? 'bg-[#4F46E5] border-[#4F46E5] text-white shadow-md'
                  : 'bg-white border-slate-200 text-[#0F172A] hover:border-[#C7D2FE]'
              }`}
            >
              {hasOwnBooking && (
                <span
                  aria-hidden="true"
                  className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-[#4F46E5]'
                  }`}
                />
              )}
              <span
                className={`block text-[11px] font-semibold uppercase tracking-wide ${
                  isSelected ? 'text-indigo-100' : 'text-[#475569]'
                }`}
              >
                {isToday ? 'Dziś' : weekday}
              </span>
              <span className="block text-lg font-bold leading-tight">{dayNumber}</span>
              <span
                className={`block text-[11px] font-semibold mt-0.5 ${
                  isSelected
                    ? 'text-indigo-100'
                    : isFull
                    ? 'text-[#DC2626]'
                    : 'text-[#059669]'
                }`}
              >
                {isFull ? 'Brak miejsc' : `${free} wolne`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
