const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { annee } = req.query;
  if (annee) {
    const rows = db
      .prepare('SELECT * FROM jours_feries WHERE date LIKE ? ORDER BY date')
      .all(`${annee}-%`);
    return res.json(rows);
  }
  res.json(db.prepare('SELECT * FROM jours_feries ORDER BY date').all());
});

router.post('/', (req, res) => {
  const { date, nom } = req.body;
  if (!date || !nom) {
    return res.status(400).json({ error: 'date et nom sont requis' });
  }
  try {
    const info = db.prepare('INSERT INTO jours_feries (date, nom) VALUES (?, ?)').run(date, nom);
    res.status(201).json(db.prepare('SELECT * FROM jours_feries WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    res.status(400).json({ error: 'Cette date est deja enregistree comme jour ferie' });
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM jours_feries WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Jour ferie introuvable' });
  res.status(204).end();
});

module.exports = router;
