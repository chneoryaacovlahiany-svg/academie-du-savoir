const express = require('express');
const db = require('../db');

const router = express.Router();

// Chacun ne voit que ses propres notifications (jamais celles d'un autre
// employe, meme pour un admin): l'employee_id de la session ecrase tout
// parametre de requete, sur le meme modele que /api/avertissements.
router.get('/', (req, res) => {
  if (!req.user.employee_id) return res.json([]);
  const rows = db
    .prepare('SELECT * FROM notifications WHERE employee_id = ? ORDER BY date_creation DESC LIMIT 200')
    .all(req.user.employee_id);
  res.json(rows);
});

router.post('/tout-marquer-lu', (req, res) => {
  if (!req.user.employee_id) return res.json({ ok: true });
  db.prepare('UPDATE notifications SET lu = 1 WHERE employee_id = ? AND lu = 0').run(req.user.employee_id);
  res.json({ ok: true });
});

module.exports = router;
