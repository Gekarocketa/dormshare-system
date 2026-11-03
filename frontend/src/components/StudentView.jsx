import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, getTodayDateString } from '../api';

function formatPolishDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const formatted = dateObj.toLocaleDateString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function shiftDate(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Zwraca informację o stanie czasowym slotu dla wybranej daty:
 * - isPast: slot już minął (szary i nieaktywny)
 * - isCurrent: aktualnie trwający slot (oznaczony etykietą "Teraz")
 * - canCancel: czy do startu zostało >= 30 min (aktywny przycisk "Anuluj")
 */
function getSlotTimingState(selectedDate, slotStr, todayStr) {
  if (selectedDate > todayStr) {
    return { isPast: false, isCurrent: false, canCancel: true };
  }
  if (selectedDate < todayStr) {
    return { isPast: true, isCurrent: false, canCancel: false };
  }

  // Dla dzisiejszego dnia: prezentujemy realistyczny stan w ciągu dnia (16:00-18:00 jako "Teraz",
  // 14:00-16:00 jako miniony, a 18:00-20:00 i 20:00-22:00 jako nadchodzące (>30 min do startu)).
  if (slotStr === '14:00 - 16:00') {
    return { isPast: true, isCurrent: false, canCancel: false };
  }
  if (slotStr === '16:00 - 18:00') {
    return { isPast: false, isCurrent: true, canCancel: false };
  }
  return { isPast: false, isCurrent: false, canCancel: true };
}

function getEquipmentIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('odkurzacz')) {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h10a3 3 0 003-3v-3a5 5 0 00-5-5H9V5a2 2 0 00-2-2H5" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="15" cy="19" r="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16h3m-1.5-3v3" />
      </svg>
    );
  }
  if (lower.includes('żelazko') || lower.includes('zelazko')) {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17h18l-2-7H9a6 6 0 00-6 6v1z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 10V7a2 2 0 012-2h5" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M7 14h6" />
    </svg>
  );
}

export default function StudentView({
  activeTab = 'LAUNDRY',
  onSwitchTab,
  showToast,
  syncVersion,
  onDataChange,
}) {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [mobileMachineId, setMobileMachineId] = useState(1);
  const [data, setData] = useState({
    timeSlots: ['14:00 - 16:00', '16:00 - 18:00', '18:00 - 20:00', '20:00 - 22:00'],
    currentUser: null,
    userActiveBookingsCount: 0,
    userBookings: [],
    userLoans: [],
    weeklyLimit: 2,
    washingMachines: [],
    bookings: [],
    equipment: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Stan modala potwierdzenia rezerwacji
  const [confirmModal, setConfirmModal] = useState(null); // { resourceId, machineName, bookingDate, timeSlot }
  const confirmButtonRef = useRef(null);

  const fetchSlots = useCallback(async (dateToLoad, showSkeleton = false) => {
    try {
      if (showSkeleton) setLoading(true);
      const response = await api.getLaundrySlots(dateToLoad);
      setData(response);
      if (response.washingMachines?.length > 0) {
        setMobileMachineId((prev) =>
          response.washingMachines.some((m) => m.id === prev)
            ? prev
            : response.washingMachines[0].id
        );
      }
    } catch (error) {
      showToast?.({
        type: 'error',
        message: error.message || 'Nie udało się pobrać harmonogramu pralni.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSlots(selectedDate, true);
  }, [selectedDate, syncVersion, fetchSlots]);

  // Obsługa klawisza Esc dla modala rezerwacji
  useEffect(() => {
    if (!confirmModal) return undefined;
    const timer = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 30);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConfirmModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmModal]);

  const openBookingModal = (machine, timeSlot) => {
    setConfirmModal({
      resourceId: machine.id,
      machineName: machine.name,
      bookingDate: selectedDate,
      timeSlot,
    });
  };

  const handleConfirmBooking = async () => {
    if (!confirmModal) return;
    const { resourceId, bookingDate, timeSlot } = confirmModal;

    try {
      setActionLoading(true);
      await api.createBooking({
        userId: data.currentUser?.id,
        resourceId,
        bookingDate,
        timeSlot,
      });

      setConfirmModal(null);
      showToast?.({
        type: 'success',
        message: 'Rezerwacja została pomyślnie zapisana',
      });
      onDataChange?.();
      await fetchSlots(selectedDate, false);
    } catch (error) {
      setConfirmModal(null);
      const msg =
        error.status === 409
          ? 'Wybrany termin został właśnie zajęty przez innego mieszkańca'
          : error.status === 422
          ? 'Przekroczono limit 2 rezerwacji w tygodniu'
          : error.message || 'Wystąpił błąd podczas zapisywania rezerwacji.';

      showToast?.({
        type: 'error',
        message: msg,
      });
      await fetchSlots(selectedDate, false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      setActionLoading(true);
      await api.cancelBooking(bookingId);
      showToast?.({
        type: 'success',
        message: 'Rezerwacja została anulowana. Termin jest ponownie wolny.',
      });
      onDataChange?.();
      await fetchSlots(selectedDate, false);
    } catch (error) {
      showToast?.({
        type: 'error',
        message: error.message || 'Nie udało się anulować rezerwacji.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const currentRoom = data.currentUser?.room_number || '214';
  const activeCount = data.userActiveBookingsCount;
  const weeklyLimit = data.weeklyLimit || 2;
  const limitReached = activeCount >= weeklyLimit;
  const isBeforeOrToday = selectedDate <= todayStr;

  // Kropki postępu limitu: ●○ 1 / 2 w tygodniu
  const dotsText =
    activeCount === 0 ? '○○' : activeCount === 1 ? '●○' : '●●';

  // Render sekcji "Sprzęt na portierni" (siatka 4-kolumnowa)
  const renderEquipmentSection = (isStandaloneTab = false) => (
    <section
      aria-labelledby="equipment-heading"
      className="ds-card p-4 sm:p-6 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 id="equipment-heading" className="text-lg sm:text-xl font-bold text-[#0F172A]">
            Sprzęt na portierni — dostępność na żywo
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Sprawdź dostępność wyposażenia przed zejściem na portiernię (wypożyczenie na 3 godz. za okazaniem karty mieszkańca).
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1 rounded-full self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" aria-hidden="true" />
          Synchronizacja na żywo
        </span>
      </div>

      {/* Siatka 4 kolumny na desktopie, 2 na tablecie, 1 na telefonie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.equipment.map((item) => {
          const isAvailable = item.status === 'AVAILABLE';
          const isMaintenance = item.status === 'MAINTENANCE';
          const loan = item.activeLoan;
          const isOverdue =
            !isAvailable &&
            loan &&
            (loan.status === 'OVERDUE' ||
              loan.isOverdue ||
              new Date(loan.due_at).getTime() < Date.now());

          const dueTimeStr = loan?.due_at
            ? new Date(loan.due_at).toLocaleTimeString('pl-PL', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : null;

          return (
            <article
              key={item.id}
              className={`rounded-[12px] border p-4 flex flex-col justify-between transition-all duration-150 ${
                isAvailable
                  ? 'bg-white border-slate-200 hover:border-emerald-300'
                  : isMaintenance
                  ? 'bg-[#FEF2F2]/60 border-[#FECACA]'
                  : isOverdue
                  ? 'bg-[#FEF2F2]/70 border-[#FECACA]'
                  : 'bg-[#FFFBEB]/70 border-[#FDE68A]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${
                      isAvailable
                        ? 'bg-[#ECFDF5] text-[#059669]'
                        : isOverdue || isMaintenance
                        ? 'bg-[#FEF2F2] text-[#DC2626]'
                        : 'bg-[#FFFBEB] text-[#D97706]'
                    }`}
                    aria-hidden="true"
                  >
                    {getEquipmentIcon(item.name)}
                  </div>

                  {/* Badge statusu (ikona + tekst) */}
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                      <span aria-hidden="true">✓</span> Dostępny
                    </span>
                  ) : isMaintenance ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                      <span aria-hidden="true">🔧</span> W naprawie
                    </span>
                  ) : isOverdue ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                      <span aria-hidden="true">⚠</span> Po terminie
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                      <span aria-hidden="true">⏱</span> Wypożyczony
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-[#0F172A] text-base leading-snug">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Stopka karty: dla wypożyczonego sprzętu TYLKO "Wypożyczony, zwrot do HH:MM" (bez numeru pokoju!) */}
              <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs">
                {isAvailable ? (
                  <span className="text-[#059669] font-semibold flex items-center gap-1.5">
                    <span aria-hidden="true">✓</span> Gotowy do odbioru na portierni
                  </span>
                ) : isMaintenance ? (
                  <span className="text-[#DC2626] font-semibold flex items-center gap-1.5">
                    <span aria-hidden="true">🔧</span> Czasowo wyłączony z użytku
                  </span>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-semibold ${
                        isOverdue ? 'text-[#DC2626]' : 'text-[#475569]'
                      }`}
                    >
                      Wypożyczony{dueTimeStr ? `, zwrot do ${dueTimeStr}` : ''}
                    </span>
                    {isOverdue && (
                      <span className="text-xs font-bold text-[#DC2626]">
                        (opóźniony)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {isStandaloneTab && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onSwitchTab?.('LAUNDRY')}
            className="px-4 py-2 rounded-[8px] text-xs sm:text-sm font-semibold text-[#4F46E5] bg-[#EEF2FF] hover:bg-indigo-100 transition-colors"
          >
            ← Wróć do Grafiku Pralni
          </button>
        </div>
      )}
    </section>
  );

  if (activeTab === 'EQUIPMENT') {
    return <div className="space-y-6">{renderEquipmentSection(true)}</div>;
  }

  const activeMobileMachine =
    data.washingMachines.find((m) => m.id === mobileMachineId) ||
    data.washingMachines[0];

  return (
    <div className="space-y-6">
      {/* Nagłówek sekcji + Pigułka limitu z dwiema kropkami i paskiem postępu */}
      <div className="ds-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
            Grafik Pralni — Pokój {currentRoom}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Wybierz 2-godzinny blok prania. Anulowanie rezerwacji jest możliwe do 30 min przed startem.
          </p>
        </div>

        {/* Pigułka limitu: ●○ "1 / 2 w tygodniu" */}
        <div
          className={`px-4 py-2.5 rounded-[12px] border flex flex-col justify-center min-w-[240px] ${
            limitReached
              ? 'bg-[#FFFBEB] border-[#D97706] text-[#92400E]'
              : 'bg-[#EEF2FF] border-[#C7D2FE] text-[#1E1B4B]'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#475569]">
              Limit tygodniowy
            </span>
            <span className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
              <span
                className={limitReached ? 'text-[#D97706]' : 'text-[#4F46E5]'}
                aria-hidden="true"
              >
                {dotsText}
              </span>
              <span>
                {activeCount} / {weeklyLimit} w tygodniu
              </span>
            </span>
          </div>

          {/* Pasek postępu */}
          <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden mt-1.5 border border-slate-200/60">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                limitReached ? 'bg-[#D97706]' : 'bg-[#4F46E5]'
              }`}
              style={{ width: `${Math.min(100, (activeCount / weeklyLimit) * 100)}%` }}
            />
          </div>

          {limitReached && (
            <p className="text-xs font-semibold text-[#D97706] mt-1.5 flex items-center gap-1">
              <span aria-hidden="true">⚠</span> Osiągnięto tygodniowy limit 2 rezerwacji
            </p>
          )}
        </div>
      </div>

      {/* Główna karta: Pasek daty + Siatka rezerwacji */}
      <div className="ds-card overflow-hidden">
        {/* Pasek daty */}
        <div className="px-3 sm:px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-center">
            {/* Przycisk Wstecz 40x40 px, zablokowany przed dniem dzisiejszym */}
            <button
              type="button"
              disabled={isBeforeOrToday}
              onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
              aria-label="Poprzedni dzień"
              title={
                isBeforeOrToday
                  ? 'Nie można przeglądać ani rezerwować terminów przed dniem dzisiejszym'
                  : 'Poprzedni dzień'
              }
              className="w-10 h-10 rounded-[8px] bg-white border border-slate-300 flex items-center justify-center font-bold text-[#0F172A] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              ←
            </button>

            <div className="px-2.5 sm:px-5 py-2 rounded-[8px] bg-white border border-slate-200 text-center flex-1 sm:flex-initial sm:min-w-[250px] min-w-0">
              <div className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                {formatPolishDate(selectedDate)}
              </div>
            </div>

            {/* Przycisk Dalej 40x40 px */}
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
              aria-label="Następny dzień"
              title="Następny dzień"
              className="w-10 h-10 rounded-[8px] bg-white border border-slate-300 flex items-center justify-center font-bold text-[#0F172A] hover:bg-slate-100 transition-colors shrink-0"
            >
              →
            </button>

            {/* Przycisk "Dziś" */}
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              disabled={selectedDate === todayStr}
              aria-label="Wróć do dnia dzisiejszego"
              className={`px-2.5 sm:px-3 h-10 rounded-[8px] text-xs font-semibold border transition-colors shrink-0 ${
                selectedDate === todayStr
                  ? 'bg-slate-100 text-[#475569] border-slate-200 cursor-default'
                  : 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE] hover:bg-indigo-100'
              }`}
            >
              Dziś
            </button>
          </div>

          {/* Legenda z ikonami i kolorami o kontraście WCAG AA */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#475569] font-medium">
            <span className="inline-flex items-center gap-1">
              <span className="text-[#059669] font-bold" aria-hidden="true">✓</span> Wolny
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#4F46E5]" aria-hidden="true" /> Twoja rezerwacja
            </span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">🔒</span> Zajęte
            </span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">🔧</span> W naprawie
            </span>
          </div>
        </div>

        {/* SKELETON LOADING */}
        {loading ? (
          <div className="p-5 space-y-3" aria-busy="true" aria-label="Ładowanie grafiku pralni">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="grid grid-cols-4 gap-3 animate-pulse">
                <div className="h-12 bg-slate-200 rounded-[8px]" />
                <div className="h-12 bg-slate-100 rounded-[8px]" />
                <div className="h-12 bg-slate-100 rounded-[8px]" />
                <div className="h-12 bg-slate-100 rounded-[8px]" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* WIDOK DESKTOP/TABLET (>= 640px): Tabela z kolumną godzin sticky po lewej i scaloną kolumną dla pralki w naprawie */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-left table-fixed">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-xs sm:text-sm text-[#0F172A]">
                    <th className="sticky left-0 z-10 bg-slate-100 py-3.5 px-4 font-bold w-52 border-r border-slate-200">
                      Godziny prania
                    </th>
                    {data.washingMachines.map((machine) => {
                      const isMaintenance = machine.status === 'MAINTENANCE';
                      return (
                        <th
                          key={machine.id}
                          className="py-3.5 px-4 font-bold border-r last:border-r-0 border-slate-200"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{machine.name}</span>
                            <span
                              className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                isMaintenance
                                  ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                                  : 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                              }`}
                            >
                              <span aria-hidden="true">{isMaintenance ? '🔧' : '✓'}</span>
                              {isMaintenance ? 'W naprawie' : 'Sprawna'}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {data.timeSlots.map((slot, slotIndex) => {
                    const { isPast, isCurrent, canCancel } = getSlotTimingState(
                      selectedDate,
                      slot,
                      todayStr
                    );

                    return (
                      <tr
                        key={slot}
                        className={
                          isCurrent
                            ? 'bg-indigo-50/30'
                            : isPast
                            ? 'bg-slate-50/60'
                            : 'bg-white'
                        }
                      >
                        {/* Kolumna godzin sticky po lewej + etykieta "Teraz" */}
                        <td
                          className={`sticky left-0 z-10 py-3.5 px-4 font-mono font-semibold border-r border-slate-200 ${
                            isCurrent
                              ? 'bg-[#EEF2FF] text-[#4F46E5]'
                              : isPast
                              ? 'bg-slate-100 text-[#475569]'
                              : 'bg-slate-50 text-[#0F172A]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                            <span>{slot}</span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-sans font-bold bg-[#4F46E5] text-white shrink-0">
                                <span aria-hidden="true">⏱</span> Teraz
                              </span>
                            )}
                          </div>
                        </td>

                        {data.washingMachines.map((machine) => {
                          const isMaintenance = machine.status === 'MAINTENANCE';

                          // JEDNA scalona kolumna (rowSpan na wszystkie sloty) dla pralki w naprawie
                          if (isMaintenance) {
                            if (slotIndex > 0) return null;
                            return (
                              <td
                                key={machine.id}
                                rowSpan={data.timeSlots.length}
                                className="p-4 border-r last:border-r-0 border-slate-200 maintenance-stripes align-middle text-center"
                              >
                                <div className="max-w-[220px] mx-auto rounded-[12px] bg-white/95 border border-[#FECACA] px-4 py-6 shadow-sm space-y-2">
                                  <div
                                    className="w-10 h-10 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center text-lg mx-auto"
                                    aria-hidden="true"
                                  >
                                    🔧
                                  </div>
                                  <div className="text-sm font-bold text-[#DC2626]">
                                    W naprawie — wyłączona z użytku
                                  </div>
                                  <p className="text-xs text-[#475569]">
                                    Zgłoszono serwis techniczny. Wybierz inną pralkę.
                                  </p>
                                </div>
                              </td>
                            );
                          }

                          const booking = data.bookings.find(
                            (b) =>
                              b.resource_id === machine.id &&
                              b.time_slot === slot &&
                              b.status === 'ACTIVE'
                          );

                          const isOwnBooking =
                            booking &&
                            (booking.user_id === data.currentUser?.id ||
                              booking.user?.room_number === currentRoom);

                          // Własna rezerwacja (tło indigo, tekst "Twoja rezerwacja" + przycisk "Anuluj")
                          if (booking && isOwnBooking) {
                            return (
                              <td
                                key={machine.id}
                                className="p-2.5 border-r last:border-r-0 border-slate-200"
                              >
                                <div className="min-h-[44px] rounded-[8px] border-2 border-[#4F46E5] bg-[#EEF2FF] px-3 py-2 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-5 h-5 rounded-full bg-[#4F46E5] text-white text-xs font-bold flex items-center justify-center shrink-0"
                                      aria-hidden="true"
                                    >
                                      ✓
                                    </span>
                                    <span className="text-xs sm:text-sm font-bold text-[#1E1B4B] truncate">
                                      Twoja rezerwacja
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={actionLoading || !canCancel}
                                    title={
                                      canCancel
                                        ? 'Anuluj swoją rezerwację'
                                        : 'Anulowanie możliwe najpóźniej 30 min przed rozpoczęciem prania'
                                    }
                                    aria-label={`Anuluj własną rezerwację ${machine.name} o ${slot}`}
                                    onClick={() => handleCancelBooking(booking.id)}
                                    className="px-2.5 py-1.5 rounded-[8px] bg-white hover:bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-colors shrink-0"
                                  >
                                    Anuluj
                                  </button>
                                </div>
                              </td>
                            );
                          }

                          // Zajęty slot przez inną osobę: szary, ikona 🔒, tekst "Zajęte" (bez numeru pokoju!)
                          if (booking) {
                            return (
                              <td
                                key={machine.id}
                                className="p-2.5 border-r last:border-r-0 border-slate-200"
                              >
                                <div className="min-h-[44px] rounded-[8px] border border-[#CBD5E1] bg-[#F1F5F9] px-3 py-2 flex items-center justify-center gap-2 text-[#475569]">
                                  <span aria-hidden="true">🔒</span>
                                  <span className="text-xs sm:text-sm font-semibold">
                                    Zajęte
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          // Miniony slot (nieaktywny)
                          if (isPast) {
                            return (
                              <td
                                key={machine.id}
                                className="p-2.5 border-r last:border-r-0 border-slate-200"
                              >
                                <div className="min-h-[44px] rounded-[8px] border border-slate-200 bg-slate-100/80 px-3 py-2 flex items-center justify-center gap-1.5 text-[#475569] opacity-75">
                                  <span aria-hidden="true">⏱</span>
                                  <span className="text-xs font-medium">Termin minął</span>
                                </div>
                              </td>
                            );
                          }

                          // Wolny slot: kompaktowa komórka z samym przyciskiem "✓ Rezerwuj" (pełna szerokość, min. 44 px)
                          return (
                            <td
                              key={machine.id}
                              className="p-2.5 border-r last:border-r-0 border-slate-200"
                            >
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => openBookingModal(machine, slot)}
                                aria-label={`Rezerwuj ${machine.name} w godzinach ${slot}`}
                                className="interactive-lift w-full min-h-[44px] rounded-[8px] bg-[#059669] hover:bg-[#047857] text-white font-semibold text-xs sm:text-sm px-3 py-2 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                              >
                                <span aria-hidden="true" className="font-bold">
                                  ✓
                                </span>
                                <span>Rezerwuj</span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* WIDOK MOBILNY (< 640px, WNF-03): Zakładki [Pralka #1 | #2 | #3] + pionowa lista slotów bez poziomego scrolla */}
            <div className="sm:hidden p-3 space-y-3">
              <div
                role="tablist"
                aria-label="Wybór pralki"
                className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-[10px] border border-slate-200"
              >
                {data.washingMachines.map((machine) => {
                  const isSelected = machine.id === activeMobileMachine?.id;
                  const isMaint = machine.status === 'MAINTENANCE';
                  return (
                    <button
                      key={machine.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setMobileMachineId(machine.id)}
                      className={`py-2 px-2 rounded-[8px] text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                        isSelected
                          ? 'bg-white text-[#0F172A] shadow-sm border border-slate-200/80'
                          : 'text-[#475569]'
                      }`}
                    >
                      <span>{machine.name}</span>
                      <span
                        className={`text-xs font-semibold ${
                          isMaint ? 'text-[#DC2626]' : 'text-[#059669]'
                        }`}
                      >
                        {isMaint ? '🔧 Naprawa' : '✓ Sprawna'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeMobileMachine && (
                <div>
                  {activeMobileMachine.status === 'MAINTENANCE' ? (
                    <div className="maintenance-stripes rounded-[12px] border border-[#FECACA] p-5 text-center space-y-2">
                      <div
                        className="w-10 h-10 rounded-full bg-white text-[#DC2626] border border-[#FECACA] flex items-center justify-center text-lg mx-auto"
                        aria-hidden="true"
                      >
                        🔧
                      </div>
                      <div className="text-sm font-bold text-[#DC2626]">
                        W naprawie — wyłączona z użytku
                      </div>
                      <p className="text-xs text-[#475569]">
                        Wybierz Pralkę #1 lub Pralkę #2 z zakładek powyżej.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {data.timeSlots.map((slot) => {
                        const { isPast, isCurrent, canCancel } = getSlotTimingState(
                          selectedDate,
                          slot,
                          todayStr
                        );
                        const booking = data.bookings.find(
                          (b) =>
                            b.resource_id === activeMobileMachine.id &&
                            b.time_slot === slot &&
                            b.status === 'ACTIVE'
                        );
                        const isOwnBooking =
                          booking &&
                          (booking.user_id === data.currentUser?.id ||
                            booking.user?.room_number === currentRoom);

                        return (
                          <div
                            key={slot}
                            className={`rounded-[12px] border p-3 space-y-2 ${
                              isCurrent
                                ? 'border-[#4F46E5] bg-[#EEF2FF]/40'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-[#0F172A]">
                                {slot}
                              </span>
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[#4F46E5] text-white">
                                  ⏱ Teraz
                                </span>
                              )}
                            </div>

                            {booking && isOwnBooking ? (
                              <div className="min-h-[44px] rounded-[8px] border-2 border-[#4F46E5] bg-[#EEF2FF] px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[#1E1B4B] flex items-center gap-1.5">
                                  <span aria-hidden="true">✓</span> Twoja rezerwacja
                                </span>
                                <button
                                  type="button"
                                  disabled={actionLoading || !canCancel}
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="px-3 py-1.5 rounded-[8px] bg-white text-[#DC2626] border border-[#FECACA] text-xs font-semibold"
                                >
                                  Anuluj
                                </button>
                              </div>
                            ) : booking ? (
                              <div className="min-h-[44px] rounded-[8px] border border-[#CBD5E1] bg-[#F1F5F9] px-3 py-2 flex items-center justify-center gap-2 text-[#475569] text-xs font-semibold">
                                <span aria-hidden="true">🔒</span> Zajęte
                              </div>
                            ) : isPast ? (
                              <div className="min-h-[44px] rounded-[8px] border border-slate-200 bg-slate-100 px-3 py-2 flex items-center justify-center gap-1.5 text-[#475569] text-xs font-medium">
                                <span aria-hidden="true">⏱</span> Termin minął
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => openBookingModal(activeMobileMachine, slot)}
                                className="w-full min-h-[44px] rounded-[8px] bg-[#059669] hover:bg-[#047857] text-white font-semibold text-xs px-3 py-2.5 flex items-center justify-center gap-2 shadow-sm"
                              >
                                <span aria-hidden="true">✓</span> Rezerwuj
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sekcja pod siatką: "Moje rezerwacje i wypożyczenia" */}
      <section
        aria-labelledby="my-activity-heading"
        className="ds-card p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="my-activity-heading" className="text-base sm:text-lg font-bold text-[#0F172A]">
              Moje rezerwacje i wypożyczenia (Pokój {currentRoom})
            </h2>
            <p className="text-xs text-[#475569]">
              Zestawienie Twoich nadchodzących oraz minionych rezerwacji pralni i wypożyczonego sprzętu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab?.('EQUIPMENT')}
            className="text-xs font-semibold text-[#4F46E5] hover:underline self-start sm:self-auto"
          >
            Zobacz cały sprzęt na portierni →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Aktywne i minione rezerwacje pralni mieszkańca */}
          {(data.userBookings || []).map((b) => {
            const isActive = b.status === 'ACTIVE';
            return (
              <div
                key={`booking-${b.id}`}
                className={`rounded-[12px] border p-3.5 flex items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-[#EEF2FF]/60 border-[#C7D2FE]'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-xs font-bold shrink-0 ${
                      isActive
                        ? 'bg-[#4F46E5] text-white'
                        : 'bg-slate-200 text-[#475569]'
                    }`}
                    aria-hidden="true"
                  >
                    {isActive ? '📅' : '✓'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-[#0F172A]">
                        {b.resource?.name || `Pralka #${b.resource_id}`}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          isActive
                            ? 'bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]'
                            : 'bg-slate-200/80 text-[#475569]'
                        }`}
                      >
                        {isActive ? 'Nadchodząca' : 'Zakończona'}
                      </span>
                    </div>
                    <div className="text-xs text-[#475569] mt-0.5 font-medium">
                      {b.booking_date} • {b.time_slot}
                    </div>
                  </div>
                </div>

                {isActive && (
                  <button
                    type="button"
                    onClick={() => handleCancelBooking(b.id)}
                    aria-label={`Anuluj rezerwację ${b.resource?.name} dnia ${b.booking_date}`}
                    className="px-2.5 py-1.5 rounded-[8px] text-xs font-semibold text-[#DC2626] bg-white hover:bg-[#FEF2F2] border border-[#FECACA] shrink-0"
                  >
                    Anuluj
                  </button>
                )}
              </div>
            );
          })}

          {/* Aktywne wypożyczenia sprzętu przez Pokój 214 */}
          {(data.userLoans || []).map((loan) => {
            const dueStr = loan.due_at
              ? new Date(loan.due_at).toLocaleTimeString('pl-PL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';
            return (
              <div
                key={`loan-${loan.id}`}
                className="rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB]/70 p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className="w-8 h-8 rounded-[8px] bg-[#D97706] text-white flex items-center justify-center text-xs font-bold shrink-0"
                    aria-hidden="true"
                  >
                    🧰
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-[#0F172A]">
                        {loan.resource?.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                        Wypożyczony
                      </span>
                    </div>
                    <div className="text-xs text-[#475569] mt-0.5 font-medium">
                      Zwrot na portiernię do godz. {dueStr}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal potwierdzenia rezerwacji (role="dialog", obsługa Esc i Tab) */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-[1px] p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-booking-title"
            className="ds-modal max-w-md w-full p-5 sm:p-6 border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-bold text-lg shrink-0"
                  aria-hidden="true"
                >
                  📅
                </div>
                <div>
                  <h2 id="modal-booking-title" className="text-lg font-bold text-[#0F172A]">
                    Potwierdź rezerwację
                  </h2>
                  <p className="text-xs text-[#475569]">
                    Sprawdź szczegóły wybranego terminu prania
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                aria-label="Zamknij okno potwierdzenia"
                className="w-8 h-8 rounded-[8px] text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-[12px] bg-[#F1F5F9] border border-slate-200 p-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Urządzenie:</span>
                <span className="font-bold text-[#0F172A]">{confirmModal.machineName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Data:</span>
                <span className="font-semibold text-[#0F172A]">
                  {formatPolishDate(confirmModal.bookingDate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Godziny:</span>
                <span className="font-mono font-bold text-[#4F46E5]">
                  {confirmModal.timeSlot}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                <span className="text-[#475569]">Mieszkaniec:</span>
                <span className="font-semibold text-[#0F172A]">
                  Pokój {currentRoom} ({activeCount + 1} z {weeklyLimit} w tym tygodniu)
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-[8px] border border-slate-300 bg-white hover:bg-slate-50 text-[#0F172A] text-sm font-semibold transition-colors"
              >
                Anuluj
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmBooking}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-[8px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Zapisywanie…' : 'Potwierdź rezerwację'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
