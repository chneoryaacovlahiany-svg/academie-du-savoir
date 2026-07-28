const express = require('express');
const db = require('../db');

const router = express.Router();

// Historique des avertissements automatiques deja envoyes (retards/departs
// anticipes repetes). Un compte employe ne peut consulter que ses propres
// avertissements (jamais ceux d'un autre employe); l'admin peut tout voir ou
// filtrer par employe via ?employee_id=.
router.get('/', (req, res) => {
  let { employee_id, mois } = req.query;
  if (req.user.role === 'employe') {
    employee_id = req.user.employee_id;
  }
  let requete = `SELECT h.*, e.nom, e.prenom FROM avertissements_historique h
                 JOIN employees e ON e.id = h.employee_id WHERE 1 = 1`;
  const params = [];
  if (employee_id) {
    requete += ' AND h.employee_id = ?';
    params.push(employee_id);
  }
  if (mois) {
    requete += ' AND h.mois = ?';
    params.push(mois);
  }
  requete += ' ORDER BY h.date_envoi DESC LIMIT 200';
  res.json(db.prepare(requete).all(...params));
});

module.exports = router;
