# DormShare — System wspomagający rezerwację pralni oraz ewidencję wyposażenia wspólnego w domu studenckim

Projekt realizowany w ramach przedmiotu **Projekt systemu (PSAM)**.

---

## 1. Opis projektu
**DormShare** to aplikacja webowa działająca w architekturze klient–serwer, zaprojektowana w celu cyfryzacji i usprawnienia codziennego obiegu zasobów wspólnych w domu studenckim. System zastępuje tradycyjne, papierowe zeszyty na portierni i rozwiązuje problem kolejek, nakładających się terminów prania oraz braku kontroli nad wypożyczanym sprzętem gospodarczym (odkurzacze, żelazka, blachy do pieczenia).

Główne funkcjonalności systemu:
* **Moduł Mieszkańca (Studenta):** zdalny podgląd harmonogramu pralni w czasie rzeczywistym, rezerwacja wolnych slotów czasowych (z automatyczną walidacją limitów tygodniowych), anulowanie rezerwacji oraz podgląd dostępności sprzętu na portierni.
* **Moduł Portiera (Administratora):** uproszczony pulpit operacyjny umożliwiający błyskawiczne wydawanie i odbieranie sprzętu (w maksymalnie 3 kliknięciach), podgląd alertów o przetrzymaniach (> 3h) oraz zmianę statusu technicznego urządzeń (np. oznaczenie awarii pralki).

---

## 2. Zastosowane technologie

* **Frontend:** React.js (Vite), Tailwind CSS
* **Backend:** Node.js, Express.js (REST API)
* **Baza danych i ORM:** PostgreSQL, Prisma ORM
* **Uwierzytelnianie i bezpieczeństwo:** JSON Web Token (JWT), bcrypt
* **Testowanie:** Jest, Supertest
* **Kontrola wersji i środowisko:** Git, Docker (opcjonalnie dla lokalnej bazy PostgreSQL)

### Struktura projektu
```text
dormshare/
├── frontend/               # Aplikacja kliencka SPA(React + Vite)
│   ├── src/
│   │   ├── components/     # Komponenty UI (kalendarz, tabele, nawigacja)
│   │   ├── pages/          # Widoki (Panel Studenta, Panel Portiera, Logowanie)
│   │   └── App.jsx
│   └── package.json
├── backend/                # Serwer aplikacyjny REST API (Node.js + Express)
│   ├── src/
│   │   ├── controllers/    # Logika obsługi żądań i walidacja reguł biznesowych
│   │   ├── routes/         # Definicje endpointów API (/api/laundry, /api/loans)
│   │   ├── middlewares/    # Weryfikacja JWT i ról użytkowników
│   │   └── server.js       # Punkt wejścia serwera
│   ├── prisma/
│   │   ├── schema.prisma   # Model danych (User, Resource, LaundryBooking, EquipmentLoan)
│   │   └── seed.js         # Dane początkowe (pralki, sprzęt, konta testowe)
│   └── package.json
├── docker-compose.yml      # Szybkie uruchomienie lokalnej bazy PostgreSQL
├── .gitignore
└── README.md
```

---

## 3. Wymagania środowiskowe
Aby uruchomić projekt lokalnie na komputerze, wymagane są:
* **Node.js** w wersji `18.x` lub nowszej (wraz z menedżerem pakietów `npm`)
* **PostgreSQL** w wersji `15+` (zainstalowany lokalnie lub uruchomiony przez **Docker Desktop**)
* **Git**

---

## 4. Instalacja i konfiguracja

### Krok 1: Pobranie repozytorium
```bash
git clone https://github.com/<twoja-nazwa-uzytkownika>/dormshare-psam.git
cd dormshare-psam
```

### Krok 2: Konfiguracja bazy danych i zmiennych środowiskowych
Jeśli korzystasz z Dockera, uruchom kontener z bazą danych PostgreSQL w głównym katalogu projektu:
```bash
docker compose up -d
```

Następnie w katalogu `backend/` utwórz plik `.env` na podstawie pliku `.env.example`:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dormshare?schema=public"
JWT_SECRET="super_tajny_klucz_projektowy_psam"
```

### Krok 3: Instalacja zależności i migracja bazy danych (Backend)
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma db seed
```

### Krok 4: Instalacja zależności (Frontend)
```bash
cd ../frontend
npm install
```

---

## 5. Uruchomienie aplikacji

Aplikację uruchamiamy w dwóch osobnych oknach terminala (lub równolegle):

**1. Uruchomienie serwera Backend (API):**
```bash
cd backend
npm run dev
```
*Serwer API będzie dostępny pod adresem:* `http://localhost:4000`

**2. Uruchomienie aplikacji Frontend (React):**
```bash
cd frontend
npm run dev
```
*Interfejs użytkownika będzie dostępny w przeglądarce pod adresem:* `http://localhost:5173`

---

## 6. Zaimplementowana minimalna ścieżka użytkownika (MVP — Etap 5)
W aktualnej wersji projektu zaimplementowano pełny przepływ głównej operacji biznesowej (**Rezerwacja terminu prania**):
1. Użytkownik otwiera aplikację i pobiera aktualny harmonogram dostępności pralek (`GET /api/laundry/slots`).
2. Użytkownik wybiera wolny przedział godzinowy i klika przycisk **„Rezerwuj”**.
3. Frontend wysyła żądanie `POST /api/laundry/bookings` do serwera Backend.
4. Backend weryfikuje dostępność terminu oraz limit użytkownika, po czym zapisuje rezerwację w bazie danych PostgreSQL.
5. Interfejs automatycznie odświeża siatkę godzinową, zmienia status wybranego slotu na zajęty i wyświetla potwierdzenie wykonania operacji.

---

## 7. Autorzy i podział ról w zespole

* **Yevhen Zaimenko** — Backend, architektura REST API, logika biznesowa rezerwacji i autoryzacja.
* **Ihor Komanov** — Frontend, interfejs użytkownika (UI/UX), responsywny widok kalendarza i panel mieszkańca.
* **Pavel Dzehilevich** — Projekt relacyjnej bazy danych, model Prisma ORM, migracje oraz panel portierni.
* **Dzmitry Vodzich** — Moduł statusów i raportów, scenariusze testowe, testy API oraz koordynacja dokumentacji.