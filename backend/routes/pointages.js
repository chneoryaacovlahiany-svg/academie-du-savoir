const express = require('express');
const db = require('../db');

const router = express.Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toISOString();
}

function computeHeures(entree, sortie) {
  const diffMs = new Date(sortie).getTime() - new Date(entree).getTime();
  return Math.max(0, diffMs / 1000 / 60 / 60);
}

// Statut du jour pour un employe (pointe ou non)
router.get('/statut/:employeeId', (req, res) => {
  const date = req.query.date || todayDate();
  const row = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(req.params.employeeId, date);
  res.json(row || null);
});

// Liste des pointages avec filtres optionnels
router.get('/', (req, res) => {
  const { employee_id, debut, fin } = req.query;
  let query = 'SELECT * FROM pointages WHERE 1=1';
  const params = [];
  if (employee_id) {
    query += ' AND employee_id = ?';
    params.push(employee_id);
  }
  if (debut) {
    query += ' AND date >= ?';
    params.push(debut);
  }
  if (fin) {
    query += ' AND date <= ?';
    params.push(fin);
  }
  query += ' ORDER BY date DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// Pointage entree
router.post('/entree', (req, res) => {
  const { employee_id, date } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id requis' });

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employe introuvable' });

  const jour = date || todayDate();
  const existing = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(employee_id, jour);

  if (existing && existing.heure_entree && !existing.heure_sortie) {
    return res.status(409).json({ error: 'Cet employe est deja pointe en entree aujourd\'hui' });
  }

  const heure = nowTime();
  if (existing) {
    db.prepare('UPDATE pointages SET heure_entree = ?, heure_sortie = NULL, heures_travaillees = NULL WHERE id = ?').run(
      heure,
      existing.id
    );
  } else {
    db.prepare(
      'INSERT INTO pointages (employee_id, date, heure_entree) VALUES (?, ?, ?)'
    ).run(employee_id, jour, heure);
  }

  const result = db.prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?').get(employee_id, jour);
  res.status(201).json(result);
});

// Pointage sortie
router.post('/sortie', (req, res) => {
  const { employee_id, date } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id requis' });

  const jour = date || todayDate();
  const existing = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(employee_id, jour);

  if (!existing || !existing.heure_entree) {
    return res.status(409).json({ error: 'Aucune entree enregistree pour aujourd\'hui' });
  }
  if (existing.heure_sortie) {
    return res.status(409).json({ error: 'Cet employe est deja pointe en sortie aujourd\'hui' });
  }

  const heure = nowTime();
  const heures = computeHeures(existing.heure_entree, heure);
  db.prepare('UPDATE pointages SET heure_sortie = ?, heures_travaillees = ? WHERE id = ?').run(
    heure,
    heures,
    existing.id
  );

  const result = db.prepare('SELECT * FROM pointages WHERE id = ?').get(existing.id);
  res.json(result);
});

// Ajout ou correction manuelle par un administrateur (pour un employe/jour donne)
router.post('/manuel', (req, res) => {
  const { employee_id, date, heure_entree, heure_sortie } = req.body;
  if (!employee_id || !date) {
    return res.status(400).json({ error: 'employee_id et date sont requis' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employe introuvable' });

  const heures_travaillees =
    heure_entree && heure_sortie ? computeHeures(heure_entree, heure_sortie) : null;

  const existing = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(employee_id, date);

  if (existing) {
    db.prepare(
      'UPDATE pointages SET heure_entree = ?, heure_sortie = ?, heures_travaillees = ? WHERE id = ?'
    ).run(heure_entree || null, heure_sortie || null, heures_travaillees, existing.id);
  } else {
    db.prepare(
      'INSERT INTO pointages (employee_id, date, heure_entree, heure_sortie, heures_travaillees) VALUES (?, ?, ?, ?, ?)'
    ).run(employee_id, date, heure_entree || null, heure_sortie || null, heures_travaillees);
  }

  const result = db.prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?').get(employee_id, date);
  res.json(result);
});

// Correction manuelle par un administrateur
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pointages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pointage introuvable' });

  const heure_entree = req.body.heure_entree ?? existing.heure_entree;
  const heure_sortie = req.body.heure_sortie !== undefined ? req.body.heure_sortie : existing.heure_sortie;
  const heures_travaillees =
    heure_entree && heure_sortie ? computeHeures(heure_entree, heure_sortie) : null;

  db.prepare(
    'UPDATE pointages SET heure_entree = ?, heure_sortie = ?, heures_travaillees = ? WHERE id = ?'
  ).run(heure_entree, heure_sortie, heures_travaillees, req.params.id);

  const updated = db.prepare('SELECT * FROM pointages WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM pointages WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Pointage introuvable' });
  res.status(204).end();
});

module.exports = router;
