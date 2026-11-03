import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

function formatTimeHHMM(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDelayMinutes(loan) {
  if (!loan?.due_at) return 0;
  if (typeof loan.delayMinutes === 'number' && loan.delayMinutes > 0) {
    return loan.delayMinutes;
  }
  const diff = Math.round((Date.now() - new Date(loan.due_at).getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

export default function PorterView({ showToast, syncVersion, onDataChange }) {
  const [dashboard, setDashboard] = useState({
    porter: null,
    equipment: [],
    overdueLoans: [],
    washingMachines: [],
    students: [],
  });
  const [selectedStudentByResource, setSelectedStudentByResource] = useState({});
  const [roomFilterByResource, setRoomFilterByResource] = useState({});
  const [openDropdownResourceId, setOpenDropdownResourceId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactModalLoan, setContactModalLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboard = useCallback(
    async (showSkeleton = false) => {
      try {
        if (showSkeleton) setLoading(true);
        const data = await api.getPorterDashboard();
        setDashboard(data);

        if (data.students && data.students.length > 0) {
          const defaultStudent =
            data.students.find((s) => s.room_number === '214') || data.students[0];
          setSelectedStudentByResource((prev) => {
            const next = { ...prev };
            data.equipment.forEach((item) => {
              if (!next[item.id]) {
                next[item.id] = defaultStudent.id;
              }
            });
            return next;
          });
        }
      } catch (error) {
        showToast?.({
          type: 'error',
          message: error.message || 'Nie udało się pobrać danych panelu portierni.',
        });
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchDashboard(true);
  }, [syncVersion, fetchDashboard]);

  // Obsługa klawisza Esc dla modala kontaktu i otwartego menu pokoju
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContactModalLoan(null);
        setOpenDropdownResourceId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBorrow = async (item) => {
    try {
      setActionLoading(true);
      const userId = selectedStudentByResource[item.id];
      const response = await api.borrowEquipment({
        resourceId: item.id,
        userId,
        durationHours: 3,
      });

      const borrowedStudent =
        dashboard.students.find((s) => s.id === Number(userId)) || response.loan?.user;

      onDataChange?.();
      await fetchDashboard(false);

      showToast?.({
        type: 'success',
        message: `Wydano: ${item.name} → Pokój ${borrowedStudent?.room_number || '214'}`,
        undoLabel: 'Cofnij',
        duration: 5000,
        onUndo: async () => {
          await api.restoreEquipmentState(item.id, 'AVAILABLE', null);
          onDataChange?.();
          await fetchDashboard(false);
          showToast?.({
            type: 'warning',
            message: `Cofnięto wydanie sprzętu: ${item.name}`,
            duration: 3500,
          });
        },
      });
    } catch (error) {
      showToast?.({
        type: 'error',
        message: error.message || 'Wystąpił błąd podczas wydawania sprzętu.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async (item) => {
    const previousLoanSnapshot = item.activeLoan ? { ...item.activeLoan } : null;
    try {
      setActionLoading(true);
      const targetId = item.activeLoan ? item.activeLoan.id : item.id;
      const response = await api.returnEquipment(targetId);

      onDataChange?.();
      await fetchDashboard(false);

      showToast?.({
        type: 'success',
        message:
          response.message ||
          `Odebrano zwrot: ${item.name} (Pokój ${previousLoanSnapshot?.user?.room_number || '—'})`,
        undoLabel: 'Cofnij',
        duration: 5000,
        onUndo: async () => {
          await api.restoreEquipmentState(item.id, 'BORROWED', previousLoanSnapshot);
          onDataChange?.();
          await fetchDashboard(false);
          showToast?.({
            type: 'warning',
            message: `Przywrócono wypożyczenie sprzętu: ${item.name}`,
            duration: 3500,
          });
        },
      });
    } catch (error) {
      showToast?.({
        type: 'error',
        message: error.message || 'Wystąpił błąd podczas odbierania zwrotu.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMachine = async (machine) => {
    try {
      setActionLoading(true);
      const nextStatus = machine.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
      const response = await api.toggleWashingMachineStatus(machine.id, nextStatus);

      onDataChange?.();
      await fetchDashboard(false);

      showToast?.({
        type: nextStatus === 'AVAILABLE' ? 'success' : 'warning',
        message:
          response.message ||
          `${machine.name}: zmieniono stan na „${
            nextStatus === 'AVAILABLE' ? 'Sprawna' : 'W naprawie'
          }”`,
        duration: 4000,
      });
    } catch (error) {
      showToast?.({
        type: 'error',
        message: error.message || 'Nie udało się zmienić statusu pralki.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtrowanie tabeli sprzętu po polu wyszukiwania "Szukaj pokoju lub sprzętu…"
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEquipment = dashboard.equipment.filter((item) => {
    if (!normalizedQuery) return true;
    const matchName = item.name?.toLowerCase().includes(normalizedQuery);
    const matchDesc = item.description?.toLowerCase().includes(normalizedQuery);
    const matchRoom = item.activeLoan?.user?.room_number
      ?.toLowerCase()
      .includes(normalizedQuery);
    const matchBorrower = item.activeLoan?.user?.full_name
      ?.toLowerCase()
      .includes(normalizedQuery);
    return matchName || matchDesc || matchRoom || matchBorrower;
  });

  return (
    <div className="space-y-6">
      {/* 1. Baner alertów przetrzymań (>3 godz.) na samej górze */}
      {dashboard.overdueLoans.length > 0 ? (
        <div
          role="region"
          aria-label="Alerty przetrzymań sprzętu"
          className="rounded-[12px] border-2 border-[#D97706] bg-[#FFFBEB] p-4 shadow-sm space-y-2.5"
        >
          {dashboard.overdueLoans.map((loan) => {
            const delayMins = getDelayMinutes(loan);
            const issuedAtStr = formatTimeHHMM(loan.borrowed_at);
            return (
              <div
                key={loan.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-[8px] bg-[#D97706] text-white flex items-center justify-center font-bold text-base shrink-0"
                    aria-hidden="true"
                  >
                    ⚠
                  </span>
                  <div className="text-xs sm:text-sm text-[#92400E] leading-snug">
                    <span className="font-bold uppercase tracking-wide">
                      ALERTY PRZETRZYMAŃ (powyżej 3 godz.):
                    </span>{' '}
                    <span className="font-bold text-[#0F172A]">
                      {loan.resource?.name} — Pokój {loan.user?.room_number}
                    </span>{' '}
                    <span>
                      • Wydano o {issuedAtStr} • Opóźnienie: {delayMins} min
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setContactModalLoan(loan)}
                  aria-label={`Pokaż kontakt do mieszkańca z pokoju ${loan.user?.room_number}`}
                  className="self-start md:self-auto min-h-[38px] px-3.5 py-1.5 rounded-[8px] bg-white hover:bg-amber-100 text-[#92400E] border border-[#D97706] text-xs font-bold transition-colors shrink-0 shadow-sm"
                >
                  Pokaż kontakt
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3.5 flex items-center gap-3 text-[#065F46] text-xs sm:text-sm">
          <span
            className="w-6 h-6 rounded-full bg-[#059669] text-white flex items-center justify-center text-xs font-bold shrink-0"
            aria-hidden="true"
          >
            ✓
          </span>
          <span className="font-semibold">
            Brak przeterminowanych wypożyczeń (powyżej 3 godz.). Wszystkie sprzęty są zwracane terminowo.
          </span>
        </div>
      )}

      {/* Nagłówek widoku portierni */}
      <div className="ds-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
            Ewidencja Sprzętu i Nadzór Pralek — Portiernia
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Dyżurny: <strong className="text-[#0F172A]">{dashboard.porter?.full_name || 'Jan Kowalski'}</strong> • Standardowy czas wypożyczenia sprzętu wynosi 3 godziny.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#F1F5F9] border border-slate-200 text-xs font-semibold text-[#475569] self-start sm:self-auto">
          <span>W obiegu:</span>
          <span className="text-[#0F172A] font-bold">
            {dashboard.equipment.filter((e) => e.status === 'BORROWED').length} /{' '}
            {dashboard.equipment.length} szt.
          </span>
        </div>
      </div>

      {/* 2. Karta z wyszukiwarką i tabelą ewidencji sprzętu */}
      <section aria-labelledby="porter-equipment-heading" className="ds-card overflow-visible">
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="porter-equipment-heading" className="text-base sm:text-lg font-bold text-[#0F172A]">
              Ewidencja sprzętu na portierni
            </h2>
            <p className="text-xs text-[#475569]">
              Wyszukaj pokój lub sprzęt i wydaj / odbierz zwrot jednym kliknięciem.
            </p>
          </div>

          {/* Pole wyszukiwania "Szukaj pokoju lub sprzętu…" */}
          <div className="relative w-full sm:w-72">
            <span
              className="absolute inset-y-0 left-3 flex items-center text-[#475569] pointer-events-none text-sm"
              aria-hidden="true"
            >
              🔍
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj pokoju lub sprzętu…"
              aria-label="Szukaj pokoju lub sprzętu"
              className="w-full h-10 pl-9 pr-8 rounded-[8px] border border-slate-300 bg-white text-xs sm:text-sm text-[#0F172A] placeholder:text-[#475569] shadow-sm focus:border-[#4F46E5] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Wyczyść wyszukiwanie"
                className="absolute inset-y-0 right-2 px-1.5 text-xs font-bold text-[#475569] hover:text-[#0F172A]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3" aria-busy="true">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-[8px] animate-pulse" />
            ))}
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#475569]">
            Brak sprzętu pasującego do frazy „{searchQuery}”.
          </div>
        ) : (
          <>
            {/* WIDOK DESKTOP/TABLET (>= 640px): Tabela z wierszami min. 64 px */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-xs sm:text-sm text-[#0F172A]">
                    <th className="py-3.5 px-4 font-bold">Sprzęt</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold">Wypożyczający / Termin</th>
                    <th className="py-3.5 px-4 font-bold text-right">Akcja (Wybór pokoju + 1-klik)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEquipment.map((item) => {
                    const isAvailable = item.status === 'AVAILABLE';
                    const loan = item.activeLoan;
                    const isOverdue =
                      !isAvailable &&
                      loan &&
                      (loan.status === 'OVERDUE' ||
                        loan.isOverdue ||
                        new Date(loan.due_at).getTime() < Date.now());
                    const delayMins = getDelayMinutes(loan);

                    const selectedStudentId =
                      selectedStudentByResource[item.id] || dashboard.students[0]?.id;
                    const selectedStudent =
                      dashboard.students.find((s) => s.id === Number(selectedStudentId)) ||
                      dashboard.students[0];

                    const roomFilter = (roomFilterByResource[item.id] || '').trim().toLowerCase();
                    const matchingStudents = dashboard.students.filter((s) => {
                      if (!roomFilter) return true;
                      return (
                        s.room_number.toLowerCase().includes(roomFilter) ||
                        s.full_name.toLowerCase().includes(roomFilter)
                      );
                    });

                    return (
                      <tr
                        key={item.id}
                        className={`min-h-[64px] h-16 transition-colors ${
                          isOverdue
                            ? 'bg-[#FEF2F2]/80 border-l-4 border-l-[#DC2626]'
                            : 'bg-white hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-middle">
                          <div className="font-bold text-[#0F172A]">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-[#475569]">{item.description}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-middle">
                          {isAvailable ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                              <span aria-hidden="true">✓</span> Dostępny
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                              <span aria-hidden="true">⚠</span> Po terminie (+{delayMins} min)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                              <span aria-hidden="true">⏱</span> Wypożyczony
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-middle">
                          {isAvailable ? (
                            <span className="text-xs font-medium text-[#475569]">
                              Gotowy do wydania (limit 3 godz.)
                            </span>
                          ) : (
                            <div>
                              <div className="font-bold text-[#0F172A]">
                                Pokój {loan?.user?.room_number || '—'} —{' '}
                                <span className="font-medium text-[#334155]">
                                  {loan?.user?.full_name || 'Mieszkaniec'}
                                </span>
                              </div>
                              <div className="text-xs text-[#475569] mt-0.5">
                                Wydano: {formatTimeHHMM(loan?.borrowed_at)} • Zwrot do:{' '}
                                <strong className={isOverdue ? 'text-[#DC2626]' : 'text-[#0F172A]'}>
                                  {formatTimeHHMM(loan?.due_at)}
                                </strong>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Kolumna Akcja: Select pokoju (z wyszukiwaniem po numerze lub nazwisku) + przycisk Wydaj / Odbierz zwrot */}
                        <td className="py-3.5 px-4 align-middle text-right">
                          {isAvailable ? (
                            <div className="inline-flex items-center justify-end gap-2 relative">
                              {/* Wyszukiwalny selektor pokoju */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenDropdownResourceId((prev) =>
                                      prev === item.id ? null : item.id
                                    )
                                  }
                                  aria-label={`Wybierz pokój dla ${item.name}`}
                                  aria-expanded={openDropdownResourceId === item.id}
                                  className="min-h-[40px] px-3 py-1.5 rounded-[8px] border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-[#0F172A] flex items-center gap-2 shadow-sm"
                                >
                                  <span>
                                    Pokój {selectedStudent?.room_number} — {selectedStudent?.full_name}
                                  </span>
                                  <span className="text-xs text-[#475569]" aria-hidden="true">
                                    ▾
                                  </span>
                                </button>

                                {openDropdownResourceId === item.id && (
                                  <div className="absolute right-0 mt-1 w-64 rounded-[10px] bg-white border border-slate-300 shadow-lg z-30 p-2 text-left">
                                    <input
                                      type="search"
                                      value={roomFilterByResource[item.id] || ''}
                                      onChange={(e) =>
                                        setRoomFilterByResource((prev) => ({
                                          ...prev,
                                          [item.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Wpisz nr pokoju lub nazwisko…"
                                      aria-label="Filtruj pokój po numerze lub nazwisku"
                                      autoFocus
                                      className="w-full px-2.5 py-1.5 mb-1.5 rounded-[6px] border border-slate-300 text-xs text-[#0F172A] placeholder:text-[#475569] focus:border-[#4F46E5] focus:outline-none"
                                    />
                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                      {matchingStudents.length === 0 ? (
                                        <div className="py-2 px-2 text-xs text-[#475569]">
                                          Brak pasującego pokoju
                                        </div>
                                      ) : (
                                        matchingStudents.map((student) => (
                                          <button
                                            key={student.id}
                                            type="button"
                                            onClick={() => {
                                              setSelectedStudentByResource((prev) => ({
                                                ...prev,
                                                [item.id]: student.id,
                                              }));
                                              setOpenDropdownResourceId(null);
                                            }}
                                            className={`w-full text-left px-2.5 py-2 rounded-[6px] text-xs flex items-center justify-between hover:bg-[#EEF2FF] ${
                                              student.id === Number(selectedStudentId)
                                                ? 'bg-[#EEF2FF] font-bold text-[#4F46E5]'
                                                : 'text-[#0F172A]'
                                            }`}
                                          >
                                            <span>
                                              Pokój {student.room_number} — {student.full_name}
                                            </span>
                                            {student.id === Number(selectedStudentId) && (
                                              <span aria-hidden="true">✓</span>
                                            )}
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleBorrow(item)}
                                aria-label={`Wydaj sprzęt ${item.name} dla pokoju ${selectedStudent?.room_number}`}
                                className="interactive-lift min-h-[40px] px-4 py-2 rounded-[8px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs sm:text-sm font-semibold shadow-sm disabled:opacity-50"
                              >
                                Wydaj
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleReturn(item)}
                              aria-label={`Odbierz zwrot sprzętu ${item.name}`}
                              className="interactive-lift min-h-[40px] px-4 py-2 rounded-[8px] bg-[#059669] hover:bg-[#047857] text-white text-xs sm:text-sm font-semibold shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <span aria-hidden="true">✓</span>
                              <span>Odbierz zwrot</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* WIDOK MOBILNY (< 640px): Karty sprzętu bez poziomego scrolla */}
            <div className="sm:hidden divide-y divide-slate-200">
              {filteredEquipment.map((item) => {
                const isAvailable = item.status === 'AVAILABLE';
                const loan = item.activeLoan;
                const isOverdue =
                  !isAvailable &&
                  loan &&
                  (loan.status === 'OVERDUE' ||
                    loan.isOverdue ||
                    new Date(loan.due_at).getTime() < Date.now());
                const delayMins = getDelayMinutes(loan);
                const selectedStudentId =
                  selectedStudentByResource[item.id] || dashboard.students[0]?.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 space-y-3 ${
                      isOverdue
                        ? 'bg-[#FEF2F2]/80 border-l-4 border-l-[#DC2626]'
                        : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#0F172A] text-sm">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-[#475569]">{item.description}</div>
                        )}
                      </div>
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                          ✓ Dostępny
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                          ⚠ Po terminie (+{delayMins}m)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                          ⏱ Wypożyczony
                        </span>
                      )}
                    </div>

                    {isAvailable ? (
                      <div className="space-y-2">
                        <label
                          htmlFor={`mobile-room-${item.id}`}
                          className="block text-xs font-semibold text-[#475569]"
                        >
                          Wybierz pokój mieszkańca:
                        </label>
                        <select
                          id={`mobile-room-${item.id}`}
                          value={selectedStudentId || ''}
                          onChange={(e) =>
                            setSelectedStudentByResource((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          className="w-full min-h-[44px] rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#0F172A]"
                        >
                          {dashboard.students.map((s) => (
                            <option key={s.id} value={s.id}>
                              Pokój {s.room_number} — {s.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleBorrow(item)}
                          className="w-full min-h-[44px] rounded-[8px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-sm"
                        >
                          Wydaj sprzęt
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="text-xs text-[#0F172A] bg-white/80 rounded-[8px] p-2.5 border border-slate-200">
                          <div className="font-bold">
                            Pokój {loan?.user?.room_number} — {loan?.user?.full_name}
                          </div>
                          <div className="text-[#475569] mt-0.5">
                            Wydano o {formatTimeHHMM(loan?.borrowed_at)} • Zwrot do{' '}
                            <strong className={isOverdue ? 'text-[#DC2626]' : 'text-[#0F172A]'}>
                              {formatTimeHHMM(loan?.due_at)}
                            </strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleReturn(item)}
                          className="w-full min-h-[44px] rounded-[8px] bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span aria-hidden="true">✓</span> Odbierz zwrot
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* 3. Sekcja "Status techniczny pralek" — 3 karty z przełącznikiem Toggle Switch */}
      <section aria-labelledby="washing-status-heading" className="ds-card p-4 sm:p-5 space-y-4">
        <div>
          <h2 id="washing-status-heading" className="text-base sm:text-lg font-bold text-[#0F172A]">
            Status techniczny pralek (Pralnia główna)
          </h2>
          <p className="text-xs text-[#475569]">
            Użyj przełącznika, aby włączyć pralkę do użytku („Sprawna”) lub wyłączyć ją na czas serwisu („W naprawie”).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dashboard.washingMachines.map((machine) => {
            const isAvailable = machine.status === 'AVAILABLE';

            return (
              <div
                key={machine.id}
                className={`rounded-[12px] border p-4 flex items-center justify-between gap-3 transition-colors ${
                  isAvailable
                    ? 'bg-[#ECFDF5]/60 border-[#A7F3D0]'
                    : 'bg-[#FEF2F2]/70 border-[#FECACA]'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-[#0F172A] text-base">{machine.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        isAvailable
                          ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                          : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                      }`}
                    >
                      <span aria-hidden="true">{isAvailable ? '✓' : '🔧'}</span>
                      {isAvailable ? 'Sprawna' : 'W naprawie'}
                    </span>
                  </div>
                </div>

                {/* Toggle Switch (role="switch") zamiast dwóch różnych przycisków */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAvailable}
                    aria-label={`Przełącz status ${machine.name} (obecnie ${
                      isAvailable ? 'Sprawna' : 'W naprawie'
                    })`}
                    disabled={actionLoading}
                    onClick={() => handleToggleMachine(machine)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                      isAvailable ? 'bg-[#059669]' : 'bg-slate-400'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isAvailable ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-medium text-[#475569]">
                    {isAvailable ? 'Włączona' : 'Serwis'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal "Pokaż kontakt" dla przetrzymanego sprzętu */}
      {contactModalLoan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-[1px] p-4"
          onClick={() => setContactModalLoan(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            className="ds-modal max-w-md w-full p-5 sm:p-6 border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#D97706]">
                  Kontakt w sprawie przetrzymania
                </span>
                <h2 id="contact-modal-title" className="text-lg font-bold text-[#0F172A] mt-0.5">
                  Pokój {contactModalLoan.user?.room_number} — {contactModalLoan.user?.full_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setContactModalLoan(null)}
                aria-label="Zamknij dane kontaktowe"
                className="w-8 h-8 rounded-[8px] text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-[12px] bg-[#F1F5F9] border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#475569]">Przetrzymany sprzęt:</span>
                <span className="font-bold text-[#DC2626]">
                  {contactModalLoan.resource?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#475569]">Godzina wydania:</span>
                <span className="font-semibold text-[#0F172A]">
                  {formatTimeHHMM(contactModalLoan.borrowed_at)} (opóźnienie:{' '}
                  {getDelayMinutes(contactModalLoan)} min)
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-[#475569]">Telefon wewnętrzny / kom.:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {contactModalLoan.user?.phone || '+48 791 440 408'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#475569]">E-mail mieszkańca:</span>
                <span className="font-medium text-[#4F46E5]">
                  {contactModalLoan.user?.email || 'student408@dorm.pl'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContactModalLoan(null)}
                className="min-h-[40px] px-4 py-2 rounded-[8px] bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
