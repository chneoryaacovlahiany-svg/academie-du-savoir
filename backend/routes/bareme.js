const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM bareme_conges ORDER BY anciennete_annees').all();
  res.json(rows);
});

router.put('/', (req, res) => {
  const lignes = req.body.lignes;
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Le bareme doit contenir au moins une ligne' });
  }
  for (const ligne of lignes) {
    const annees = Number(ligne.anciennete_annees);
    const jours = Number(ligne.jours_par_an);
    if (Number.isNaN(annees) || annees < 0 || Number.isNaN(jours) || jours < 0) {
      return res.status(400).json({ error: 'Anciennete et jours par an doivent etre des nombres positifs' });
    }
  }

  db.exec('DELETE FROM bareme_conges');
  const insert = db.prepare('INSERT INTO bareme_conges (anciennete_annees, jours_par_an) VALUES (?, ?)');
  for (const ligne of lignes) {
    insert.run(Number(ligne.anciennete_annees), Number(ligne.jours_par_an));
  }

  res.json(db.prepare('SELECT * FROM bareme_conges ORDER BY anciennete_annees').all());
});

module.exports = router;
