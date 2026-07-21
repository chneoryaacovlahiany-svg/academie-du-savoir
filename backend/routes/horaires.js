const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { employee_id } = req.query;
  if (!employee_id) return res.status(400).json({ error: 'employee_id requis' });
  const rows = db
    .prepare('SELECT * FROM horaires_travail WHERE employee_id = ? ORDER BY jour_semaine')
    .all(employee_id);
  res.json(rows);
});

router.put('/', (req, res) => {
  const { employee_id, lignes } = req.body;
  if (!employee_id || !Array.isArray(lignes)) {
    return res.status(400).json({ error: 'employee_id et lignes sont requis' });
  }
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employe introuvable' });

  const upsert = db.prepare(`
    INSERT INTO horaires_travail (employee_id, jour_semaine, heure_debut, heure_fin, actif)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, jour_semaine) DO UPDATE SET
      heure_debut = excluded.heure_debut,
      heure_fin = excluded.heure_fin,
      actif = excluded.actif
  `);
  for (const ligne of lignes) {
    const jourSemaine = Number(ligne.jour_semaine);
    if (Number.isNaN(jourSemaine) || jourSemaine < 0 || jourSemaine > 6) continue;
    upsert.run(employee_id, jourSemaine, ligne.heure_debut || null, ligne.heure_fin || null, ligne.actif ? 1 : 0);
  }

  const rows = db
    .prepare('SELECT * FROM horaires_travail WHERE employee_id = ? ORDER BY jour_semaine')
    .all(employee_id);
  res.json(rows);
});

module.exports = router;
