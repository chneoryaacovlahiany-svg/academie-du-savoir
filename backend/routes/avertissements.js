const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { envoyerAvertissementManuel, NB_NIVEAUX_AVERTISSEMENT } = require('../scheduler');

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

// Envoi manuel d'un avertissement, decide par l'admin, independamment du
// declenchement automatique par seuil de retards.
router.post('/envoyer', requireAdmin, async (req, res) => {
  const { employee_id, niveau, message } = req.body;
  const niveauNombre = Number(niveau);
  if (!employee_id || !Number.isInteger(niveauNombre) || niveauNombre < 1 || niveauNombre > NB_NIVEAUX_AVERTISSEMENT) {
    return res.status(400).json({ error: `Parametres invalides (niveau entre 1 et ${NB_NIVEAUX_AVERTISSEMENT})` });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message requis' });
  }
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!emp) return res.status(404).json({ error: 'Employe introuvable' });

  const { nbAppareils } = await envoyerAvertissementManuel(employee_id, niveauNombre, message.trim());
  res.status(201).json({ ok: true, nb_appareils: nbAppareils });
});

module.exports = router;
