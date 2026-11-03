import React, { useState, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar';
import StudentView from './components/StudentView';
import PorterView from './components/PorterView';
import { api } from './api';

export default function App() {
  const [role, setRole] = useState('STUDENT'); // 'STUDENT' | 'PORTER'
  const [studentTab, setStudentTab] = useState('LAUNDRY'); // 'LAUNDRY' | 'EQUIPMENT'
  const [toast, setToast] = useState(null); // { id, type: 'success' | 'error' | 'warning', message, undoLabel, onUndo, duration }
  const [equipmentCounts, setEquipmentCounts] = useState({ available: 2, total: 4 });
  const [syncVersion, setSyncVersion] = useState(0);

  const showToast = useCallback(
    ({ type = 'success', message, undoLabel = null, onUndo = null, duration = 5000 }) => {
      const id = Date.now() + Math.random();
      setToast({ id, type, message, undoLabel, onUndo, duration });
    },
    []
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshEquipmentCounts = useCallback(async () => {
    try {
      const dash = await api.getPorterDashboard();
      const total = dash.equipment.length;
      const available = dash.equipment.filter((e) => e.status === 'AVAILABLE').length;
      setEquipmentCounts({ available, total });
    } catch {
      // Ignoruj błąd pomocniczego licznika
    }
  }, []);

  useEffect(() => {
    refreshEquipmentCounts();
  }, [role, studentTab, syncVersion, refreshEquipmentCounts]);

  const notifyDataChanged = useCallback(() => {
    setSyncVersion((v) => v + 1);
  }, []);

  const handleLogoutClick = () => {
    showToast({
      type: 'warning',
      message: 'Wersja demonstracyjna: sesja użytkownika Pokój 214 jest zawsze aktywna.',
      duration: 4000,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] text-[#0F172A] overflow-x-hidden">
      <Navbar
        role={role}
        onSelectRole={setRole}
        studentTab={studentTab}
        onSelectStudentTab={setStudentTab}
        onLogoutClick={handleLogoutClick}
        availableEquipmentCount={equipmentCounts.available}
        totalEquipmentCount={equipmentCounts.total}
      />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-3 sm:px-6 py-5 sm:py-6">
        {role === 'STUDENT' ? (
          <StudentView
            activeTab={studentTab}
            onSwitchTab={setStudentTab}
            showToast={showToast}
            syncVersion={syncVersion}
            onDataChange={notifyDataChanged}
          />
        ) : (
          <PorterView
            showToast={showToast}
            syncVersion={syncVersion}
            onDataChange={notifyDataChanged}
          />
        )}
      </main>

      {/* Globalny system powiadomień Toast (prawy dolny róg na desktopie, dół ekranu na mobile) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-6 sm:max-w-md z-50 transition-all duration-200"
        >
          <div
            className={`rounded-[12px] px-4 py-3.5 shadow-lg border flex items-center justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-[#FEF2F2] border-[#DC2626] text-[#991B1B]'
                : toast.type === 'warning'
                ? 'bg-[#FFFBEB] border-[#D97706] text-[#92400E]'
                : 'bg-[#ECFDF5] border-[#059669] text-[#065F46]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                aria-hidden="true"
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                  toast.type === 'error'
                    ? 'bg-[#DC2626]'
                    : toast.type === 'warning'
                    ? 'bg-[#D97706]'
                    : 'bg-[#059669]'
                }`}
              >
                {toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : '✓'}
              </span>
              <span className="text-xs sm:text-sm font-semibold leading-snug break-words">
                {toast.message}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={async () => {
                    const undoFn = toast.onUndo;
                    setToast(null);
                    await undoFn();
                  }}
                  className="px-2.5 py-1 rounded-[8px] bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                >
                  {toast.undoLabel || 'Cofnij'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Zamknij powiadomienie"
                className="p-1 rounded-[8px] text-xs font-bold opacity-75 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-4 mt-8">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#475569] gap-2">
          <span>DormShare • System rezerwacji pralni i ewidencji sprzętu (Akademik DS-1)</span>
          <span>
            Aktywny widok:{' '}
            <strong className="text-[#0F172A]">
              {role === 'STUDENT'
                ? 'Mieszkaniec — Pokój 214 (Yevhen Zaimenko)'
                : 'Portiernia — Dyżurny (Jan Kowalski)'}
            </strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
