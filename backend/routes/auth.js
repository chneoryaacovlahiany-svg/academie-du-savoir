const express = require('express');
const db = require('../db');
const { verifyPassword, hashPassword } = require('../passwords');
const { signerToken, definirCookieSession, effacerCookieSession } = require('../auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function infosUtilisateur(utilisateur) {
  let employee = null;
  if (utilisateur.employee_id) {
    employee = db.prepare('SELECT id, nom, prenom FROM employees WHERE id = ?').get(utilisateur.employee_id);
  }
  return {
    id: utilisateur.id,
    email: utilisateur.email,
    role: utilisateur.role,
    employee_id: utilisateur.employee_id,
    employee,
  };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }
  const utilisateur = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim());
  if (!utilisateur || !utilisateur.actif || !verifyPassword(password, utilisateur.password_hash)) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }
  const token = signerToken({ id: utilisateur.id });
  definirCookieSession(res, req, token);
  res.json(infosUtilisateur(utilisateur));
});

router.post('/logout', (req, res) => {
  effacerCookieSession(res, req);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  const utilisateur = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(infosUtilisateur(utilisateur));
});

router.put('/password', requireAuth, (req, res) => {
  const { mot_de_passe_actuel, nouveau_mot_de_passe } = req.body;
  if (!mot_de_passe_actuel || !nouveau_mot_de_passe) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
  }
  if (nouveau_mot_de_passe.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caracteres' });
  }
  const utilisateur = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(mot_de_passe_actuel, utilisateur.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(nouveau_mot_de_passe), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
