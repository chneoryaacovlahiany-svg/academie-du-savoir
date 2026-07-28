const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const CLES = ['nom', 'adresse', 'telephone', 'email', 'logo'];

function chargerInfosEntreprise() {
  const rows = db.prepare("SELECT cle, valeur FROM parametres WHERE cle LIKE 'entreprise_%'").all();
  const infos = { nom: '', adresse: '', telephone: '', email: '', logo: '' };
  for (const row of rows) {
    const cle = row.cle.replace('entreprise_', '');
    if (CLES.includes(cle)) infos[cle] = row.valeur;
  }
  return infos;
}

router.get('/', (req, res) => {
  res.json(chargerInfosEntreprise());
});

router.put('/', requireAdmin, (req, res) => {
  const maj = db.prepare(
    'INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur'
  );
  for (const cle of CLES) {
    if (req.body[cle] !== undefined) {
      maj.run(`entreprise_${cle}`, String(req.body[cle]));
    }
  }
  res.json(chargerInfosEntreprise());
});

module.exports = router;
module.exports.chargerInfosEntreprise = chargerInfosEntreprise;
