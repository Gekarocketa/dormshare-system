const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const TIME_SLOTS = [
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
  '20:00 - 22:00',
];

export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateString(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Wspólne źródło prawdy (Single Source of Truth) dla obu widoków (Mieszkaniec + Portiernia).
 * Zapewnia 100% spójności statusów sprzętu, rezerwacji i czasu zwrotu (due_at = wydano + 3h).
 */
const DEMO_STUDENTS = [
  {
    id: 1,
    full_name: 'Yevhen Zaimenko',
    room_number: '214',
    email: 'student214@dorm.pl',
    phone: '+48 512 340 214',
    role: 'STUDENT',
  },
  {
    id: 2,
    full_name: 'Marek Nowak',
    room_number: '105',
    email: 'student105@dorm.pl',
    phone: '+48 604 118 105',
    role: 'STUDENT',
  },
  {
    id: 3,
    full_name: 'Anna Wiśniewska',
    room_number: '312',
    email: 'student312@dorm.pl',
    phone: '+48 509 772 312',
    role: 'STUDENT',
  },
  {
    id: 4,
    full_name: 'Piotr Zieliński',
    room_number: '408',
    email: 'student408@dorm.pl',
    phone: '+48 791 440 408',
    role: 'STUDENT',
  },
];

const DEMO_PORTER = {
  id: 5,
  full_name: 'Jan Kowalski',
  room_number: 'Portiernia',
  email: 'portier@dorm.pl',
  role: 'PORTER',
};

function createInitialStore() {
  const now = new Date();
  const today = getTodayDateString();
  const yesterday = shiftDateString(today, -1);

  // Odkurzacz #2: wydano o 11:15 dla Pokoju 408 -> due_at = wydano + 3h (14:15) -> po terminie (opóźnienie 45 min)
  const [yYest, mYest, dYest] = yesterday.split('-').map(Number);
  const borrowedAtOverdue = new Date(yYest, mYest - 1, dYest, 11, 15, 0);
  const dueAtOverdue = new Date(borrowedAtOverdue.getTime() + 3 * 60 * 60 * 1000); // 14:15

  // Żelazko #1: wydano o 14:30 dla Pokoju 214 -> due_at = wydano + 3h (17:30, aktywne wypożyczenie w terminie)
  const [yTod, mTod, dTod] = today.split('-').map(Number);
  let borrowedAtActive = new Date(yTod, mTod - 1, dTod, 14, 30, 0);
  if (borrowedAtActive.getTime() + 3 * 60 * 60 * 1000 <= now.getTime()) {
    borrowedAtActive = new Date(now.getTime() - 60 * 60 * 1000);
  }
  const dueAtActive = new Date(borrowedAtActive.getTime() + 3 * 60 * 60 * 1000);

  return {
    initializedFromBackend: false,
    students: [...DEMO_STUDENTS],
    porter: { ...DEMO_PORTER },
    washingMachines: [
      {
        id: 1,
        name: 'Pralka #1',
        category: 'WASHING_MACHINE',
        status: 'AVAILABLE',
        description: 'Pralka automatyczna Bosch 8 kg — parter, pralnia główna',
      },
      {
        id: 2,
        name: 'Pralka #2',
        category: 'WASHING_MACHINE',
        status: 'AVAILABLE',
        description: 'Pralka automatyczna Bosch 8 kg — parter, pralnia główna',
      },
      {
        id: 3,
        name: 'Pralka #3',
        category: 'WASHING_MACHINE',
        status: 'MAINTENANCE',
        description: 'Awaria pompy odpływowej — wyłączona z użytku',
      },
    ],
    equipment: [
      {
        id: 4,
        name: 'Odkurzacz #1',
        category: 'EQUIPMENT',
        status: 'AVAILABLE',
        description: 'Odkurzacz bezworkowy Philips PowerPro Compact',
        activeLoan: null,
      },
      {
        id: 5,
        name: 'Odkurzacz #2',
        category: 'EQUIPMENT',
        status: 'BORROWED',
        description: 'Odkurzacz workowy Zelmer Odyssey',
        activeLoan: {
          id: 201,
          user_id: 4,
          resource_id: 5,
          porter_id: 5,
          borrowed_at: borrowedAtOverdue.toISOString(),
          due_at: dueAtOverdue.toISOString(),
          returned_at: null,
          status: 'OVERDUE',
          delayMinutes: 45,
          user: DEMO_STUDENTS[3], // Pokój 408 — Piotr Zieliński
        },
      },
      {
        id: 6,
        name: 'Żelazko #1',
        category: 'EQUIPMENT',
        status: 'BORROWED',
        description: 'Żelazko parowe Tefal + deska do prasowania',
        activeLoan: {
          id: 202,
          user_id: 1,
          resource_id: 6,
          porter_id: 5,
          borrowed_at: borrowedAtActive.toISOString(),
          due_at: dueAtActive.toISOString(),
          returned_at: null,
          status: 'ACTIVE',
          user: DEMO_STUDENTS[0], // Pokój 214 — Yevhen Zaimenko
        },
      },
      {
        id: 7,
        name: 'Blacha do pieczenia #1',
        category: 'EQUIPMENT',
        status: 'AVAILABLE',
        description: 'Zestaw blach do piekarnika w kuchni wspólnej',
        activeLoan: null,
      },
    ],
    bookings: [
      {
        id: 101,
        user_id: 2,
        resource_id: 1,
        booking_date: today,
        time_slot: '14:00 - 16:00',
        status: 'ACTIVE',
        user: DEMO_STUDENTS[1], // Pokój 105
        resource: { id: 1, name: 'Pralka #1' },
      },
      {
        id: 102,
        user_id: 1,
        resource_id: 2,
        booking_date: today,
        time_slot: '18:00 - 20:00',
        status: 'ACTIVE',
        user: DEMO_STUDENTS[0], // Pokój 214 (własna rezerwacja)
        resource: { id: 2, name: 'Pralka #2' },
      },
      {
        id: 103,
        user_id: 3,
        resource_id: 2,
        booking_date: today,
        time_slot: '20:00 - 22:00',
        status: 'ACTIVE',
        user: DEMO_STUDENTS[2], // Pokój 312
        resource: { id: 2, name: 'Pralka #2' },
      },
      {
        id: 104,
        user_id: 1,
        resource_id: 1,
        booking_date: yesterday,
        time_slot: '16:00 - 18:00',
        status: 'COMPLETED',
        user: DEMO_STUDENTS[0], // Pokój 214 (miniona rezerwacja w historii)
        resource: { id: 1, name: 'Pralka #1' },
      },
    ],
    nextBookingId: 500,
    nextLoanId: 600,
  };
}

const store = createInitialStore();

/**
 * Przelicza w locie status każdego wypożyczenia na podstawie due_at (= wydano + 3h)
 * względem aktualnego czasu, zapewniając identyczny wynik w obu widokach.
 */
function normalizeEquipmentState() {
  const nowMs = Date.now();

  store.equipment = store.equipment.map((item) => {
    if (item.status !== 'BORROWED' || !item.activeLoan) {
      return {
        ...item,
        activeLoan: null,
      };
    }

    const borrowedMs = new Date(item.activeLoan.borrowed_at).getTime();
    // Gwarancja reguły biznesowej: due_at = borrowed_at + 3h (jeśli brak due_at)
    const dueMs = item.activeLoan.due_at
      ? new Date(item.activeLoan.due_at).getTime()
      : borrowedMs + 3 * 60 * 60 * 1000;

    const isOverdue = dueMs < nowMs;
    const computedDelay = isOverdue ? Math.max(1, Math.round((nowMs - dueMs) / 60000)) : 0;
    const delayMinutes =
      isOverdue && item.activeLoan.delayMinutes ? item.activeLoan.delayMinutes : computedDelay;

    return {
      ...item,
      activeLoan: {
        ...item.activeLoan,
        due_at: new Date(dueMs).toISOString(),
        status: isOverdue ? 'OVERDUE' : 'ACTIVE',
        isOverdue,
        delayMinutes,
      },
    };
  });
}

async function tryBackendRequest(endpoint, options = {}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export const api = {
  /**
   * GET /api/laundry/slots?date=YYYY-MM-DD
   */
  getLaundrySlots: async (date) => {
    const targetDate = date || getTodayDateString();
    normalizeEquipmentState();

    const currentUser = store.students.find((s) => s.room_number === '214') || store.students[0];

    const bookingsForDate = store.bookings.filter(
      (b) => b.booking_date === targetDate && b.status === 'ACTIVE'
    );

    const userActiveBookingsCount = store.bookings.filter(
      (b) => b.user_id === currentUser.id && b.status === 'ACTIVE'
    ).length;

    const userBookings = store.bookings
      .filter((b) => b.user_id === currentUser.id && b.status !== 'CANCELLED')
      .sort((a, b) => (a.booking_date < b.booking_date ? 1 : -1));

    const userLoans = store.equipment
      .filter((e) => e.status === 'BORROWED' && e.activeLoan?.user?.room_number === currentUser.room_number)
      .map((e) => ({
        ...e.activeLoan,
        resource: { id: e.id, name: e.name, description: e.description },
      }));

    return {
      date: targetDate,
      timeSlots: TIME_SLOTS,
      currentUser,
      userActiveBookingsCount,
      userBookings,
      userLoans,
      weeklyLimit: 2,
      washingMachines: store.washingMachines.map((m) => ({ ...m })),
      bookings: bookingsForDate.map((b) => ({ ...b })),
      equipment: store.equipment.map((e) => ({
        ...e,
        activeLoan: e.activeLoan ? { ...e.activeLoan } : null,
      })),
    };
  },

  /**
   * POST /api/laundry/bookings
   */
  createBooking: async ({ userId, resourceId, bookingDate, timeSlot }) => {
    normalizeEquipmentState();

    const currentUser =
      store.students.find((s) => s.id === Number(userId)) ||
      store.students.find((s) => s.room_number === '214');

    const machine = store.washingMachines.find((m) => m.id === Number(resourceId));
    if (!machine || machine.status !== 'AVAILABLE') {
      const err = new Error('Wybrana pralka jest w naprawie');
      err.status = 422;
      throw err;
    }

    const activeCount = store.bookings.filter(
      (b) => b.user_id === currentUser.id && b.status === 'ACTIVE'
    ).length;

    if (activeCount >= 2) {
      const err = new Error('Przekroczono limit 2 rezerwacji w tygodniu');
      err.status = 422;
      throw err;
    }

    const conflict = store.bookings.find(
      (b) =>
        b.resource_id === Number(resourceId) &&
        b.booking_date === String(bookingDate) &&
        b.time_slot === String(timeSlot) &&
        b.status === 'ACTIVE'
    );

    if (conflict) {
      const err = new Error('Wybrany termin został właśnie zajęty przez innego mieszkańca');
      err.status = 409;
      throw err;
    }

    const newBooking = {
      id: store.nextBookingId++,
      user_id: currentUser.id,
      resource_id: machine.id,
      booking_date: String(bookingDate),
      time_slot: String(timeSlot),
      status: 'ACTIVE',
      user: currentUser,
      resource: { id: machine.id, name: machine.name },
    };

    store.bookings.push(newBooking);

    // Asynchroniczna synchronizacja z backendem, jeśli jest uruchomiony
    tryBackendRequest('/laundry/bookings', {
      method: 'POST',
      body: JSON.stringify({ userId: currentUser.id, resourceId, bookingDate, timeSlot }),
    });

    return {
      message: 'Rezerwacja została pomyślnie zapisana',
      booking: newBooking,
    };
  },

  /**
   * DELETE /api/laundry/bookings/:id
   */
  cancelBooking: async (bookingId) => {
    const idx = store.bookings.findIndex((b) => b.id === Number(bookingId));
    if (idx === -1) {
      const err = new Error('Nie znaleziono rezerwacji o podanym ID.');
      err.status = 404;
      throw err;
    }

    const snapshot = { ...store.bookings[idx] };
    store.bookings[idx] = {
      ...store.bookings[idx],
      status: 'CANCELLED',
    };

    tryBackendRequest(`/laundry/bookings/${bookingId}`, { method: 'DELETE' });

    return {
      message: 'Rezerwacja została anulowana',
      booking: store.bookings[idx],
      previousBooking: snapshot,
    };
  },

  /**
   * GET /api/porter/dashboard
   */
  getPorterDashboard: async () => {
    normalizeEquipmentState();

    const overdueLoans = store.equipment
      .filter((item) => item.status === 'BORROWED' && item.activeLoan?.isOverdue)
      .map((item) => ({
        ...item.activeLoan,
        resource: {
          id: item.id,
          name: item.name,
        },
      }));

    return {
      porter: { ...store.porter },
      equipment: store.equipment.map((e) => ({
        ...e,
        activeLoan: e.activeLoan ? { ...e.activeLoan } : null,
      })),
      overdueLoans,
      washingMachines: store.washingMachines.map((m) => ({ ...m })),
      students: store.students.map((s) => ({ ...s })),
    };
  },

  /**
   * POST /api/porter/loans/borrow
   * Czas wypożyczenia: 3 godziny (due_at = wydano + 3h)
   */
  borrowEquipment: async ({ resourceId, userId, roomNumber, durationHours = 3 }) => {
    normalizeEquipmentState();

    const itemIndex = store.equipment.findIndex((e) => e.id === Number(resourceId));
    if (itemIndex === -1) {
      const err = new Error('Nie znaleziono wskazanego sprzętu.');
      err.status = 404;
      throw err;
    }

    const item = store.equipment[itemIndex];
    if (item.status !== 'AVAILABLE') {
      const err = new Error('Wybrany sprzęt jest już wypożyczony lub niedostępny.');
      err.status = 422;
      throw err;
    }

    let student = null;
    if (userId) {
      student = store.students.find((s) => s.id === Number(userId));
    }
    if (!student && roomNumber) {
      student = store.students.find((s) => s.room_number === String(roomNumber));
    }
    if (!student) {
      student = store.students[0];
    }

    const now = new Date();
    const dueAt = new Date(now.getTime() + Number(durationHours) * 60 * 60 * 1000);

    const createdLoan = {
      id: store.nextLoanId++,
      user_id: student.id,
      resource_id: item.id,
      porter_id: store.porter.id,
      borrowed_at: now.toISOString(),
      due_at: dueAt.toISOString(),
      returned_at: null,
      status: 'ACTIVE',
      isOverdue: false,
      delayMinutes: 0,
      user: { ...student },
      resource: { id: item.id, name: item.name },
    };

    store.equipment[itemIndex] = {
      ...item,
      status: 'BORROWED',
      activeLoan: createdLoan,
    };

    tryBackendRequest('/porter/loans/borrow', {
      method: 'POST',
      body: JSON.stringify({ resourceId, userId: student.id, durationHours }),
    });

    return {
      message: `Wydano: ${item.name} → Pokój ${student.room_number}`,
      loan: createdLoan,
    };
  },

  /**
   * POST /api/porter/loans/:id/return
   */
  returnEquipment: async (loanOrResourceId) => {
    normalizeEquipmentState();

    const idNum = Number(loanOrResourceId);
    let itemIndex = store.equipment.findIndex(
      (e) => e.activeLoan?.id === idNum || e.id === idNum
    );

    if (itemIndex === -1) {
      const err = new Error('Nie znaleziono aktywnego wypożyczenia do zwrotu.');
      err.status = 404;
      throw err;
    }

    const item = store.equipment[itemIndex];
    const previousLoan = item.activeLoan ? { ...item.activeLoan } : null;

    store.equipment[itemIndex] = {
      ...item,
      status: 'AVAILABLE',
      activeLoan: null,
    };

    tryBackendRequest(`/porter/loans/${idNum}/return`, { method: 'POST' });

    return {
      message: `Odebrano zwrot: ${item.name}${
        previousLoan?.user?.room_number ? ` (Pokój ${previousLoan.user.room_number})` : ''
      }`,
      loan: previousLoan,
      resource: store.equipment[itemIndex],
    };
  },

  /**
   * Przywrócenie poprzedniego stanu wypożyczenia po kliknięciu "Cofnij" w toaście (w ciągu 5 s)
   */
  restoreEquipmentState: async (resourceId, previousStatus, previousLoan) => {
    const idx = store.equipment.findIndex((e) => e.id === Number(resourceId));
    if (idx === -1) return;
    store.equipment[idx] = {
      ...store.equipment[idx],
      status: previousStatus,
      activeLoan: previousLoan ? { ...previousLoan } : null,
    };
    normalizeEquipmentState();
  },

  /**
   * PATCH /api/porter/resources/:id/status
   */
  toggleWashingMachineStatus: async (resourceId, status) => {
    const idx = store.washingMachines.findIndex((m) => m.id === Number(resourceId));
    if (idx === -1) {
      const err = new Error('Nie znaleziono pralki o podanym ID.');
      err.status = 404;
      throw err;
    }

    const current = store.washingMachines[idx];
    const nextStatus = status || (current.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE');

    store.washingMachines[idx] = {
      ...current,
      status: nextStatus,
    };

    tryBackendRequest(`/porter/resources/${resourceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });

    return {
      message: `${current.name}: zmieniono status na „${
        nextStatus === 'AVAILABLE' ? 'Sprawna' : 'W naprawie'
      }”`,
      resource: store.washingMachines[idx],
    };
  },
};
