/**
 * Middleware sprawdzające rolę portiera na trasach /api/porter/*.
 * Jeśli nagłówek x-user-role jest jawnie podany i ma wartość inną niż 'PORTER',
 * zwraca 403 Forbidden. Gdy nagłówek nie jest podany (domyślny tryb demo MVP),
 * przepuszcza żądanie, aby przełącznik ról we frontendzie działał bez dodatkowych nagłówków.
 */
function requirePorterRole(req, res, next) {
  const userRole = req.headers['x-user-role'];

  if (userRole !== undefined && userRole !== 'PORTER') {
    return res.status(403).json({
      message: 'Brak uprawnień — dostęp tylko dla pracownika portierni',
    });
  }

  return next();
}

module.exports = {
  requirePorterRole,
};
