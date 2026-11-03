const prisma = require('../db');

/**
 * GET /api/porter/dashboard
 */
async function getPorterDashboard(req, res) {
  try {
    const now = new Date();
    const nowMs = now.getTime();

    // Automatycznie oznacz wypożyczenia po terminie (due_at < now) jako OVERDUE
    await prisma.equipmentLoan.updateMany({
      where: {
        status: 'ACTIVE',
        due_at: { lt: now },
      },
      data: {
        status: 'OVERDUE',
      },
    });

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
                email: true,
              },
            },
            porter: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
          orderBy: { borrowed_at: 'desc' },
          take: 1,
        },
      },
    });

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

    // Lista przeterminowanych wypożyczeń wyliczana z tego samego stanu
    const overdueLoans = equipment
      .filter((item) => item.status === 'BORROWED' && item.activeLoan?.status === 'OVERDUE')
      .map((item) => ({
        ...item.activeLoan,
        resource: {
          id: item.id,
          name: item.name,
        },
      }));

    const washingMachines = await prisma.resource.findMany({
      where: { category: 'WASHING_MACHINE' },
      orderBy: { id: 'asc' },
    });

    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        full_name: true,
        room_number: true,
        email: true,
      },
      orderBy: { room_number: 'asc' },
    });

    const porter = await prisma.user.findFirst({
      where: { role: 'PORTER' },
      select: {
        id: true,
        full_name: true,
        room_number: true,
        email: true,
      },
    });

    return res.json({
      porter,
      equipment,
      overdueLoans,
      washingMachines,
      students,
    });
  } catch (error) {
    console.error('Błąd w GET /api/porter/dashboard:', error);
    return res.status(500).json({
      message: 'Wystąpił błąd serwera podczas pobierania danych portierni.',
    });
  }
}

/**
 * POST /api/porter/loans/borrow
 * Body: { resourceId, userId, roomNumber, durationHours }
 * Domyślny czas wypożyczenia: 3 godziny (due_at = borrowed_at + 3 h)
 */
async function borrowEquipment(req, res) {
  try {
    const { resourceId, userId, roomNumber, durationHours = 3 } = req.body;

    if (!resourceId) {
      return res.status(400).json({ message: 'Nie wskazano sprzętu do wydania.' });
    }

    const loan = await prisma.$transaction(async (tx) => {
      const resource = await tx.resource.findUnique({
        where: { id: Number(resourceId) },
      });

      if (!resource || resource.category !== 'EQUIPMENT') {
        const err = new Error('Nie znaleziono wskazanego sprzętu.');
        err.statusCode = 404;
        throw err;
      }

      if (resource.status !== 'AVAILABLE') {
        const err = new Error('Wybrany sprzęt jest już wypożyczony lub niedostępny.');
        err.statusCode = 422;
        throw err;
      }

      let student = null;
      if (userId) {
        student = await tx.user.findUnique({ where: { id: Number(userId) } });
      } else if (roomNumber) {
        student = await tx.user.findFirst({
          where: { room_number: String(roomNumber), role: 'STUDENT' },
        });
      }
      if (!student) {
        student = await tx.user.findFirst({ where: { room_number: '214', role: 'STUDENT' } });
      }

      const porter = await tx.user.findFirst({ where: { role: 'PORTER' } });

      if (!student || !porter) {
        const err = new Error('Brak danych mieszkańca lub portiera w bazie.');
        err.statusCode = 404;
        throw err;
      }

      const now = new Date();
      const dueAt = new Date(now.getTime() + Number(durationHours) * 60 * 60 * 1000);

      const createdLoan = await tx.equipmentLoan.create({
        data: {
          user_id: student.id,
          resource_id: resource.id,
          porter_id: porter.id,
          borrowed_at: now,
          due_at: dueAt,
          status: 'ACTIVE',
        },
        include: {
          user: true,
          resource: true,
        },
      });

      await tx.resource.update({
        where: { id: resource.id },
        data: { status: 'BORROWED' },
      });

      return createdLoan;
    });

    return res.status(201).json({
      message: `Wydano: ${loan.resource.name} → Pokój ${loan.user.room_number}`,
      loan,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Błąd w POST /api/porter/loans/borrow:', error);
    return res.status(500).json({
      message: 'Wystąpił błąd serwera podczas wydawania sprzętu.',
    });
  }
}

/**
 * POST /api/porter/loans/:id/return
 */
async function returnEquipment(req, res) {
  try {
    const idParam = Number(req.params.id);

    const updatedLoan = await prisma.$transaction(async (tx) => {
      let loan = await tx.equipmentLoan.findUnique({
        where: { id: idParam },
        include: { resource: true, user: true },
      });

      if (!loan || loan.status === 'RETURNED') {
        loan = await tx.equipmentLoan.findFirst({
          where: {
            resource_id: idParam,
            status: { in: ['ACTIVE', 'OVERDUE'] },
          },
          include: { resource: true, user: true },
          orderBy: { borrowed_at: 'desc' },
        });
      }

      if (!loan) {
        const resourceOnly = await tx.resource.findUnique({ where: { id: idParam } });
        if (resourceOnly && resourceOnly.category === 'EQUIPMENT') {
          await tx.resource.update({
            where: { id: resourceOnly.id },
            data: { status: 'AVAILABLE' },
          });
          return { resource: resourceOnly, user: null };
        }

        const err = new Error('Nie znaleziono aktywnego wypożyczenia do zwrotu.');
        err.statusCode = 404;
        throw err;
      }

      const returned = await tx.equipmentLoan.update({
        where: { id: loan.id },
        data: {
          status: 'RETURNED',
          returned_at: new Date(),
        },
        include: {
          resource: true,
          user: true,
        },
      });

      await tx.resource.update({
        where: { id: loan.resource_id },
        data: { status: 'AVAILABLE' },
      });

      return returned;
    });

    return res.json({
      message: `Odebrano zwrot sprzętu: ${updatedLoan.resource.name}`,
      loan: updatedLoan,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Błąd w POST /api/porter/loans/:id/return:', error);
    return res.status(500).json({
      message: 'Wystąpił błąd serwera podczas odbierania zwrotu sprzętu.',
    });
  }
}

/**
 * PATCH /api/porter/resources/:id/status
 */
async function updateResourceStatus(req, res) {
  try {
    const resourceId = Number(req.params.id);
    const { status } = req.body;

    const existing = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Nie znaleziono zasobu o podanym ID.' });
    }

    const nextStatus =
      status || (existing.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE');

    const updated = await prisma.resource.update({
      where: { id: resourceId },
      data: { status: nextStatus },
    });

    return res.json({
      message: `${updated.name}: zmieniono status na „${
        updated.status === 'AVAILABLE' ? 'Sprawna' : 'W naprawie'
      }”`,
      resource: updated,
    });
  } catch (error) {
    console.error('Błąd w PATCH /api/porter/resources/:id/status:', error);
    return res.status(500).json({
      message: 'Wystąpił błąd serwera podczas zmiany statusu zasobu.',
    });
  }
}

module.exports = {
  getPorterDashboard,
  borrowEquipment,
  returnEquipment,
  updateResourceStatus,
};
