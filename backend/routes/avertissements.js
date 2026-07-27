const express = require('express');
const db = require('../db');

const router = express.Router();

// Historique des avertissements automatiques deja envoyes (retards/departs
// anticipes repetes). Reserve a l'admin: ce n'est pas un rapport que
// l'employe consulte lui-meme dans l'application.
router.get('/', (req, res) => {
  const { employee_id, mois } = req.query;
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
