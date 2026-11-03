const prisma = require('../db');

const TIME_SLOTS = [
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
  '20:00 - 22:00',
];

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Synchronizuje status przeterminowanych wypożyczeń na podstawie due_at (= wydano + 3h)
 * względem aktualnego czasu, aby oba widoki (Mieszkaniec i Portiernia) miały identyczny stan.
 */
async function syncOverdueLoans() {
  const now = new Date();
  await prisma.equipmentLoan.updateMany({
    where: {
      status: 'ACTIVE',
      due_at: { lt: now },
    },
    data: {
      status: 'OVERDUE',
    },
  });
}

/**
 * GET /api/laundry/slots?date=YYYY-MM-DD&userId=...
 */
async function getLaundrySlots(req, res) {
  try {
    await syncOverdueLoans();

    const date = req.query.date || getTodayDateString();
    const requestedUserId = req.query.userId ? Number(req.query.userId) : null;

    let currentUser = null;
    if (requestedUserId) {
      currentUser = await prisma.user.findUnique({ where: { id: requestedUserId } });
    }
    if (!currentUser) {
      currentUser = await prisma.user.findFirst({
        where: { room_number: '214', role: 'STUDENT' },
      });
    }
    if (!currentUser) {
      currentUser = await prisma.user.findFirst({
        where: { role: 'STUDENT' },
      });
    }

    const washingMachines = await prisma.resource.findMany({
      where: { category: 'WASHING_MACHINE' },
      orderBy: { id: 'asc' },
    });

    const bookings = await prisma.laundryBooking.findMany({
      where: {
        booking_date: date,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            room_number: true,
          },
        },
        resource: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const userActiveBookingsCount = currentUser
      ? await prisma.laundryBooking.count({
          where: {
            user_id: currentUser.id,
            status: 'ACTIVE',
          },
        })
      : 0;

    // Pobierz również wszystkie rezerwacje bieżącego użytkownika (do sekcji "Moje rezerwacje i wypożyczenia")
    const userBookings = currentUser
      ? await prisma.laundryBooking.findMany({
          where: { user_id: currentUser.id },
          include: {
            resource: {
              select: { id: true, name: true },
            },
          },
          orderBy: [{ booking_date: 'desc' }, { time_slot: 'asc' }],
          take: 6,
        })
      : [];

    const equipmentRaw = await prisma.resource.findMany({
      where: { category: 'EQUIPMENT' },
      orderBy: { id: 'asc' },
      include: {
        equipment_loans: {
          where: {
            status: { in: ['ACTIVE', 'OVERDUE'] },
          },
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                room_number: true,
              },
            },
          },
          orderBy: { borrowed_at: 'desc' },
          take: 1,
        },
      },
    });

    const nowMs = Date.now();
    const equipment = equipmentRaw.map((item) => {
      const rawLoan = item.equipment_loans[0] || null;
      let activeLoan = null;
      if (rawLoan && item.status === 'BORROWED') {
        const isOverdue = new Date(rawLoan.due_at).getTime() < nowMs || rawLoan.status === 'OVERDUE';
        activeLoan = {
          ...rawLoan,
          status: isOverdue ? 'OVERDUE' : 'ACTIVE',
        };
      }
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        status: item.status,
        description: item.description,
        activeLoan,
      };
    });

    return res.json({
      date,
      timeSlots: TIME_SLOTS,
      currentUser,
      userActiveBookingsCount,
      userBookings,
      weeklyLimit: 2,
      washingMachines,
      bookings,
      equipment,
    });
  } catch (error) {
    console.error('Błąd w GET /api/laundry/slots:', error);
    return res.status(500).json({
      message: 'Wystąpił błąd serwera podczas pobierania harmonogramu pralni.',
    });
  }
}

/**
 * POST /api/laundry/bookings
 * Body: { userId, resourceId, bookingDate, timeSlot }
 */
async function createLaundryBooking(req, res) {
  try {
    const { userId, resourceId, bookingDate, timeSlot } = req.body;

    if (!resourceId || !bookingDate || !timeSlot) {
      return res.status(400).json({
        message: 'Brakuje wymaganych danych rezerwacji (pralka, data lub przedział godzinowy).',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let user = null;
      if (userId) {
        user = await tx.user.findUnique({ where: { id: Number(userId) } });
      }
      if (!user) {
        user = await tx.user.findFirst({ where: { room_number: '214', role: 'STUDENT' } });
      }
      if (!user) {
        const err = new Error('Nie znaleziono użytkownika.');
        err.statusCode = 404;
        throw err;
      }

      const resource = await tx.resource.findUnique({
        where: { id: Number(resourceId) },
      });

      if (!resource || resource.category !== 'WASHING_MACHINE') {
        const err = new Error('Wybrana pralka nie istnieje.');
        err.statusCode = 404;
        throw err;
      }

      if (resource.status !== 'AVAILABLE') {
        const err = new Error('Wybrana pralka jest w naprawie');
        err.statusCode = 422;
        throw err;
      }

      const activeBookingsCount = await tx.laundryBooking.count({
        where: {
          user_id: user.id,
          status: 'ACTIVE',
        },
      });

      if (activeBookingsCount >= 2) {
        const err = new Error('Przekroczono limit 2 rezerwacji w tygodniu');
        err.statusCode = 422;
        throw err;
      }

      const conflictingBooking = await tx.laundryBooking.findFirst({
        where: {
          resource_id: Number(resourceId),
          booking_date: String(bookingDate),
          time_slot: String(timeSlot),
          status: 'ACTIVE',
        },
      });

      if (conflictingBooking) {
        const err = new Error('Wybrany termin został właśnie zajęty przez innego mieszkańca');
        err.statusCode = 409;
        throw err;
      }

      const createdBooking = await tx.laundryBooking.create({
        data: {
          user_id: user.id,
          resource_id: Number(resourceId),
          booking_date: String(bookingDate),
          time_slot: String(timeSlot),
          status: 'ACTIVE',
        },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              room_number: true,
            },
          },
          resource: true,
        },
      });

      return createdBooking;
    });

    return res.status(201).json({
      message: 'Rezerwacja została pomyślnie zapisana',
      booking: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Błąd w POST /api/laundry/bookings:', error);
    return res.status(500).json({
      message: 'Wystąpił błąd serwera podczas zapisywania rezerwacji.',
    });
  }
}

/**
 * DELETE /api/laundry/bookings/:id
 */
async function cancelLaundryBooking(req, res) {
  try {
    const bookingId = Number(req.params.id);

    const existing = await prisma.laundryBooking.findUnique({
      where: { id: bookingId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Nie znaleziono rezerwacji o podanym ID.' });
    }

    const updated = await prisma.laundryBooking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    return res.json({
      message: 'Rezerwacja została anulowana',
      booking: updated,
    });
  } catch (error) {
    console.error('Błąd w DELETE /api/laundry/bookings/:id:', error);
    return res.status(500).json({
      message: 'Wystąpił błąd serwera podczas anulowania rezerwacji.',
    });
  }
}

module.exports = {
  getLaundrySlots,
  createLaundryBooking,
  cancelLaundryBooking,
};
