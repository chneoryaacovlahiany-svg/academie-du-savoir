const express = require('express');
const db = require('../db');
const { chargerParametres } = require('../soldes');

const router = express.Router();

const CLES_CONNUES = [
  'semaine_jours',
  'heures_standard_jour',
  'seuil_heures_sup_125',
  'majoration_heures_sup_125',
  'majoration_heures_sup_150',
  'plafond_conges_maladie',
  'accumulation_maladie_mois',
];

router.get('/', (req, res) => {
  res.json(chargerParametres());
});

router.put('/', (req, res) => {
  const maj = db.prepare('INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur');
  for (const cle of CLES_CONNUES) {
    if (req.body[cle] !== undefined) {
      const valeur = Number(req.body[cle]);
      if (Number.isNaN(valeur) || valeur < 0) {
        return res.status(400).json({ error: `Valeur invalide pour ${cle}` });
      }
      maj.run(cle, String(valeur));
    }
  }
  res.json(chargerParametres());
});

module.exports = router;
