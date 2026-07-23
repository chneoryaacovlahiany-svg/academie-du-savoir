const db = require('../db');
const { parseCookies, verifierToken, COOKIE_NAME } = require('../auth');

// Verifie la session et attache l'utilisateur courant (recharge depuis la
// base a chaque requete, pour prendre en compte un compte desactive ou
// modifie sans attendre l'expiration du cookie).
function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const payload = verifierToken(cookies[COOKIE_NAME]);
  if (!payload) {
    return res.status(401).json({ error: 'Non authentifie' });
  }
  const utilisateur = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!utilisateur || !utilisateur.actif) {
    return res.status(401).json({ error: 'Session invalide' });
  }
  req.user = {
    id: utilisateur.id,
    email: utilisateur.email,
    role: utilisateur.role,
    employee_id: utilisateur.employee_id,
  };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Reserve aux administrateurs' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
