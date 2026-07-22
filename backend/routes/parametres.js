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

// Une ou plusieurs IP separees par des virgules (ex: "88.12.34.56, 88.12.34.57").
function ipBureauValide(valeur) {
  if (valeur.trim() === '') return true;
  return valeur
    .split(',')
    .map((ip) => ip.trim())
    .every((ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every((o) => Number(o) <= 255));
}

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
  if (req.body.ip_bureau !== undefined) {
    if (!ipBureauValide(req.body.ip_bureau)) {
      return res.status(400).json({ error: 'Valeur invalide pour ip_bureau (IPv4, separees par des virgules)' });
    }
    maj.run('ip_bureau', req.body.ip_bureau.trim());
  }
  res.json(chargerParametres());
});

module.exports = router;
