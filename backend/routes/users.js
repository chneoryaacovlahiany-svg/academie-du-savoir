const express = require('express');
const db = require('../db');
const { hashPassword } = require('../passwords');

const router = express.Router();

const ROLES_VALIDES = ['admin', 'employe'];

function ajouterEmploye(utilisateur) {
  const { password_hash, ...reste } = utilisateur;
  let employee = null;
  if (utilisateur.employee_id) {
    employee = db.prepare('SELECT id, nom, prenom FROM employees WHERE id = ?').get(utilisateur.employee_id);
  }
  return { ...reste, employee };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY email').all();
  res.json(rows.map(ajouterEmploye));
});

router.post('/', (req, res) => {
  const { email, password, role, employee_id } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caracteres' });
  }
  const roleFinal = ROLES_VALIDES.includes(role) ? role : 'employe';
  if (roleFinal === 'employe' && !employee_id) {
    return res.status(400).json({ error: 'Un compte employe doit etre lie a un employe' });
  }
  if (employee_id) {
    const employe = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
    if (!employe) return res.status(404).json({ error: 'Employe introuvable' });
  }

  try {
    const info = db
      .prepare('INSERT INTO users (email, password_hash, role, employee_id) VALUES (?, ?, ?, ?)')
      .run(String(email).trim(), hashPassword(password), roleFinal, employee_id || null);
    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(ajouterEmploye(created));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Cet identifiant est deja utilise' });
    }
    throw err;
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Compte introuvable' });

  const email = req.body.email !== undefined ? String(req.body.email).trim() : existing.email;
  const role = req.body.role !== undefined && ROLES_VALIDES.includes(req.body.role) ? req.body.role : existing.role;
  const employee_id = req.body.employee_id !== undefined ? req.body.employee_id : existing.employee_id;
  const actif = req.body.actif !== undefined ? (req.body.actif ? 1 : 0) : existing.actif;

  if (role === 'employe' && !employee_id) {
    return res.status(400).json({ error: 'Un compte employe doit etre lie a un employe' });
  }
  if (employee_id) {
    const employe = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
    if (!employe) return res.status(404).json({ error: 'Employe introuvable' });
  }

  const password_hash =
    req.body.password && req.body.password.length >= 6 ? hashPassword(req.body.password) : existing.password_hash;
  if (req.body.password && req.body.password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caracteres' });
  }

  try {
    db.prepare(
      'UPDATE users SET email = ?, password_hash = ?, role = ?, employee_id = ?, actif = ? WHERE id = ?'
    ).run(email, password_hash, role, employee_id || null, actif, req.params.id);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Cet identifiant est deja utilise' });
    }
    throw err;
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(ajouterEmploye(updated));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Compte introuvable' });
  res.status(204).end();
});

module.exports = router;
