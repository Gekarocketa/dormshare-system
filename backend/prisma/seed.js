const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  console.log('Rozpoczynanie seedowania bazy danych DormShare...');

  await prisma.equipmentLoan.deleteMany();
  await prisma.laundryBooking.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.user.deleteMany();

  // 1. Tworzenie użytkowników: 4 pokoje studenckie (105, 214, 312, 408) + 1 portier
  const student105 = await prisma.user.create({
    data: {
      email: 'student105@dorm.pl',
      password_hash: 'hashed_demo_pass_105',
      full_name: 'Marek Nowak',
      room_number: '105',
      role: 'STUDENT',
    },
  });

  const student214 = await prisma.user.create({
    data: {
      email: 'student214@dorm.pl',
      password_hash: 'hashed_demo_pass_214',
      full_name: 'Yevhen Zaimenko',
      room_number: '214',
      role: 'STUDENT',
    },
  });

  const student312 = await prisma.user.create({
    data: {
      email: 'student312@dorm.pl',
      password_hash: 'hashed_demo_pass_312',
      full_name: 'Anna Wiśniewska',
      room_number: '312',
      role: 'STUDENT',
    },
  });

  const student408 = await prisma.user.create({
    data: {
      email: 'student408@dorm.pl',
      password_hash: 'hashed_demo_pass_408',
      full_name: 'Piotr Zieliński',
      room_number: '408',
      role: 'STUDENT',
    },
  });

  const porter = await prisma.user.create({
    data: {
      email: 'portier@dorm.pl',
      password_hash: 'hashed_demo_pass_porter',
      full_name: 'Jan Kowalski',
      room_number: 'Portiernia',
      role: 'PORTER',
    },
  });

  // 2. Tworzenie pralek (3 sztuki)
  const pralka1 = await prisma.resource.create({
    data: {
      name: 'Pralka #1',
      category: 'WASHING_MACHINE',
      status: 'AVAILABLE',
      description: 'Pralka automatyczna Bosch 8 kg — parter, pralnia główna',
    },
  });

  const pralka2 = await prisma.resource.create({
    data: {
      name: 'Pralka #2',
      category: 'WASHING_MACHINE',
      status: 'AVAILABLE',
      description: 'Pralka automatyczna Bosch 8 kg — parter, pralnia główna',
    },
  });

  const pralka3 = await prisma.resource.create({
    data: {
      name: 'Pralka #3',
      category: 'WASHING_MACHINE',
      status: 'MAINTENANCE',
      description: 'Awaria pompy odpływowej — zgłoszono serwis techniczny',
    },
  });

  // 3. Tworzenie sprzętu na portierni (4 sztuki)
  const odkurzacz1 = await prisma.resource.create({
    data: {
      name: 'Odkurzacz #1',
      category: 'EQUIPMENT',
      status: 'AVAILABLE',
      description: 'Odkurzacz bezworkowy Philips PowerPro Compact',
    },
  });

  const odkurzacz2 = await prisma.resource.create({
    data: {
      name: 'Odkurzacz #2',
      category: 'EQUIPMENT',
      status: 'BORROWED',
      description: 'Odkurzacz workowy Zelmer Odyssey',
    },
  });

  const zelazko1 = await prisma.resource.create({
    data: {
      name: 'Żelazko #1',
      category: 'EQUIPMENT',
      status: 'AVAILABLE',
      description: 'Żelazko parowe Tefal + deska do prasowania',
    },
  });

  const blacha1 = await prisma.resource.create({
    data: {
      name: 'Blacha do pieczenia #1',
      category: 'EQUIPMENT',
      status: 'AVAILABLE',
      description: 'Zestaw blach do piekarnika w kuchni wspólnej',
    },
  });

  // 4. Rezerwacje prania na dzisiejszą datę (pokazujące wszystkie stany)
  const today = getTodayDateString();

  // Cudza rezerwacja (Pokój 105)
  await prisma.laundryBooking.create({
    data: {
      user_id: student105.id,
      resource_id: pralka1.id,
      booking_date: today,
      time_slot: '14:00 - 16:00',
      status: 'ACTIVE',
    },
  });

  // Własna rezerwacja (Pokój 214 — główny użytkownik demo)
  await prisma.laundryBooking.create({
    data: {
      user_id: student214.id,
      resource_id: pralka2.id,
      booking_date: today,
      time_slot: '18:00 - 20:00',
      status: 'ACTIVE',
    },
  });

  // Druga cudza rezerwacja (Pokój 312)
  await prisma.laundryBooking.create({
    data: {
      user_id: student312.id,
      resource_id: pralka2.id,
      booking_date: today,
      time_slot: '20:00 - 22:00',
      status: 'ACTIVE',
    },
  });

  // 5. Przetrzymane wypożyczenie: Odkurzacz #2 — Pokój 408 (wydano 3h 45min temu, due_at = wydano + 3h, opóźnienie 45 min)
  const now = new Date();
  const borrowedAt408 = new Date(now.getTime() - (3 * 60 + 45) * 60 * 1000);
  const dueAt408 = new Date(borrowedAt408.getTime() + 3 * 60 * 60 * 1000);

  await prisma.equipmentLoan.create({
    data: {
      user_id: student408.id,
      resource_id: odkurzacz2.id,
      porter_id: porter.id,
      borrowed_at: borrowedAt408,
      due_at: dueAt408,
      status: 'OVERDUE',
    },
  });

  console.log('Seedowanie zakończone pomyślnie!', {
    rooms: [student105.room_number, student214.room_number, student312.room_number, student408.room_number],
    initialBookingDate: today,
  });
}

main()
  .catch((e) => {
    console.error('Błąd podczas seedowania bazy danych:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
