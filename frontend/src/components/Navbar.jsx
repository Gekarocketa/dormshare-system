import React from 'react';

export default function Navbar({
  role,
  onSelectRole,
  studentTab,
  onSelectStudentTab,
  onLogoutClick,
  availableEquipmentCount,
  totalEquipmentCount,
}) {
  const isStudent = role === 'STUDENT';

  return (
    <header className="sticky top-0 z-40 bg-[#0F172A] text-white shadow-md border-b border-slate-800">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Lewa strona: Logo "DS" + "DormShare" + badge "AKADEMIK DS-1" */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] bg-[#4F46E5] flex items-center justify-center font-bold text-sm sm:text-base tracking-tight text-white shadow-sm shrink-0"
              aria-hidden="true"
            >
              DS
            </div>
            <div className="flex items-center flex-wrap gap-2 min-w-0">
              <span className="text-base sm:text-xl font-bold tracking-tight text-white">
                DormShare
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 whitespace-nowrap">
                AKADEMIK DS-1
              </span>
            </div>
          </div>

          {/* Prawa strona: Pigułka "Pokój 214", przycisk "Wyloguj" (ghost) i Segmented Control "Tryb demo:" */}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 ml-auto">
            {/* Pigułka Pokój 214 */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold text-slate-100"
              title={
                isStudent
                  ? 'Zalogowany mieszkaniec: Yevhen Zaimenko (Pokój 214)'
                  : 'Konto demonstracyjne: Pokój 214 / Portiernia'
              }
            >
              <span className="w-2 h-2 rounded-full bg-[#059669]" aria-hidden="true" />
              <span>Pokój 214</span>
            </div>

            {/* Przycisk Wyloguj (ghost) */}
            <button
              type="button"
              onClick={onLogoutClick}
              aria-label="Wyloguj z systemu DormShare"
              className="px-2.5 py-1.5 rounded-[8px] text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Wyloguj
            </button>

            {/* Przełącznik widoku "Tryb demo:" z segmented control [Mieszkaniec | Portiernia] */}
            <div className="flex items-center gap-2 bg-slate-950/70 p-1 rounded-[10px] border border-slate-800">
              <span className="hidden md:inline-block text-xs font-medium text-slate-300 pl-2">
                Tryb demo:
              </span>
              <div
                role="group"
                aria-label="Tryb demo — przełącznik widoku"
                className="inline-flex items-center rounded-[8px]"
              >
                <button
                  type="button"
                  onClick={() => onSelectRole('STUDENT')}
                  aria-pressed={isStudent}
                  aria-label="Przełącz na widok mieszkańca"
                  className={`px-2.5 sm:px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-all duration-150 ${
                    isStudent
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  Mieszkaniec
                </button>
                <button
                  type="button"
                  onClick={() => onSelectRole('PORTER')}
                  aria-pressed={!isStudent}
                  aria-label="Przełącz na widok portierni"
                  className={`px-2.5 sm:px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-all duration-150 ${
                    !isStudent
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  Portiernia
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pasek zakładek pod nagłówkiem (widoczny w widoku mieszkańca) */}
      {isStudent && (
        <div className="bg-white text-[#0F172A] border-b border-slate-200">
          <div className="max-w-[1200px] mx-auto px-3 sm:px-6">
            <nav
              role="tablist"
              aria-label="Sekcje panelu mieszkańca"
              className="flex items-center gap-2 sm:gap-6 -mb-px"
            >
              <button
                type="button"
                role="tab"
                aria-selected={studentTab === 'LAUNDRY'}
                onClick={() => onSelectStudentTab('LAUNDRY')}
                className={`py-3 px-2 sm:px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                  studentTab === 'LAUNDRY'
                    ? 'border-[#4F46E5] text-[#4F46E5]'
                    : 'border-transparent text-[#475569] hover:text-[#0F172A] hover:border-slate-300'
                }`}
              >
                <span aria-hidden="true">📅</span>
                <span>Grafik Pralni</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={studentTab === 'EQUIPMENT'}
                onClick={() => onSelectStudentTab('EQUIPMENT')}
                className={`py-3 px-2 sm:px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                  studentTab === 'EQUIPMENT'
                    ? 'border-[#4F46E5] text-[#4F46E5]'
                    : 'border-transparent text-[#475569] hover:text-[#0F172A] hover:border-slate-300'
                }`}
              >
                <span aria-hidden="true">🧰</span>
                <span>Sprzęt na portierni</span>
                {typeof availableEquipmentCount === 'number' &&
                  typeof totalEquipmentCount === 'number' && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        studentTab === 'EQUIPMENT'
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : 'bg-slate-100 text-[#475569]'
                      }`}
                    >
                      {availableEquipmentCount}/{totalEquipmentCount} wolne
                    </span>
                  )}
              </button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
