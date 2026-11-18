import React, { useState } from 'react';

/**
 * Konta demonstracyjne (zgodne z danymi startowymi w api.js / prisma/seed.js).
 * Właściwa weryfikacja JWT + bcrypt jest po stronie backendu — tutaj
 * wykonujemy tylko walidację formularza i wybór roli dla wersji MVP.
 */
export const DEMO_ACCOUNTS = [
  {
    email: 'student214@dorm.pl',
    password: 'demo123',
    role: 'STUDENT',
    label: 'Mieszkaniec',
    full_name: 'Yevhen Zaimenko',
    room_number: '214',
  },
  {
    email: 'portier@dorm.pl',
    password: 'demo123',
    role: 'PORTER',
    label: 'Portiernia',
    full_name: 'Jan Kowalski',
    room_number: 'Portiernia',
  },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = 'Podaj adres e-mail.';
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Niepoprawny format adresu e-mail.';
    if (!password) next.password = 'Podaj hasło.';
    else if (password.length < 6) next.password = 'Hasło musi mieć co najmniej 6 znaków.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    // Krótkie opóźnienie, aby stan ładowania był widoczny (symulacja żądania)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const account = DEMO_ACCOUNTS.find(
      (a) => a.email === email.trim().toLowerCase() && a.password === password
    );

    setSubmitting(false);
    if (!account) {
      setFormError('Nieprawidłowy e-mail lub hasło.');
      return;
    }

    const { password: _omit, ...user } = account;
    onLogin(user);
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
    setFormError('');
  };

  const inputClass = (hasError) =>
    `w-full h-11 px-3 rounded-[8px] border bg-white text-sm text-[#0F172A] placeholder:text-slate-400 transition-colors ${
      hasError
        ? 'border-[#DC2626] focus:border-[#DC2626]'
        : 'border-slate-300 focus:border-[#4F46E5]'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] text-[#0F172A]">
      <header className="bg-[#0F172A] text-white border-b border-slate-800">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-3 flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-[10px] bg-[#4F46E5] flex items-center justify-center font-bold tracking-tight"
            aria-hidden="true"
          >
            DS
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight">DormShare</span>
          <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
            AKADEMIK DS-1
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-3 sm:px-6 py-8">
        <div className="w-full max-w-md">
          <div className="ds-card p-5 sm:p-7">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Zaloguj się</h1>
            <p className="text-sm text-[#475569] mt-1">
              Rezerwacja pralni i wypożyczanie sprzętu w akademiku.
            </p>

            {formError && (
              <div
                role="alert"
                className="mt-4 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm font-semibold text-[#991B1B]"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-semibold mb-1.5">
                  Adres e-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  placeholder="np. student214@dorm.pl"
                  className={inputClass(errors.email)}
                />
                {errors.email && (
                  <p id="login-email-error" className="text-xs font-semibold text-[#DC2626] mt-1">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-semibold mb-1.5">
                  Hasło
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    className={`${inputClass(errors.password)} pr-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-[6px] text-xs font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]"
                  >
                    {showPassword ? 'Ukryj' : 'Pokaż'}
                  </button>
                </div>
                {errors.password && (
                  <p id="login-password-error" className="text-xs font-semibold text-[#DC2626] mt-1">
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="interactive-lift w-full h-11 rounded-[8px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
              >
                {submitting ? 'Logowanie…' : 'Zaloguj'}
              </button>
            </form>
          </div>

          {/* Szybki wybór konta demonstracyjnego */}
          <div className="mt-4 ds-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Konta demonstracyjne (hasło: demo123)
            </p>
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="interactive-lift text-left rounded-[8px] border border-slate-200 bg-slate-50 hover:bg-white px-3 py-2.5"
                >
                  <span className="block text-sm font-semibold">{account.label}</span>
                  <span className="block text-xs text-[#475569] truncate">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
