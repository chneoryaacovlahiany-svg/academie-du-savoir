const express = require('express');
const db = require('../db');
const { enregistrerNotification } = require('../notifications');
const { requireAdmin } = require('../middleware/auth');

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

// Vue de supervision reservee aux admins: historique de tous les employes,
// avec leur nom, filtrable par ?employee_id=. Distincte de la route ci-dessus
// qui reste strictement limitee a l'employe de la session.
router.get('/admin', requireAdmin, (req, res) => {
  const { employee_id } = req.query;
  let requete = `SELECT n.*, e.nom, e.prenom FROM notifications n JOIN employees e ON e.id = n.employee_id WHERE 1 = 1`;
  const params = [];
  if (employee_id) {
    requete += ' AND n.employee_id = ?';
    params.push(employee_id);
  }
  requete += ' ORDER BY n.date_creation DESC LIMIT 200';
  res.json(db.prepare(requete).all(...params));
});

// Journalise un rappel affiche localement par le navigateur (Pointage.jsx),
// qui n'a jamais transite par le serveur puisqu'il s'affiche uniquement
// quand l'onglet est ouvert: sans cet appel, ce rappel n'apparaitrait jamais
// dans l'historique, contrairement aux rappels envoyes par le planificateur.
router.post('/', (req, res) => {
  if (!req.user.employee_id) return res.status(400).json({ error: 'Compte non lie a un employe.' });
  const { type, titre, corps } = req.body;
  if (!type || !titre || !corps) return res.status(400).json({ error: 'type, titre et corps sont requis.' });
  enregistrerNotification(req.user.employee_id, type, titre, corps);
  res.json({ ok: true });
});

router.post('/tout-marquer-lu', (req, res) => {
  if (!req.user.employee_id) return res.json({ ok: true });
  db.prepare('UPDATE notifications SET lu = 1 WHERE employee_id = ? AND lu = 0').run(req.user.employee_id);
  res.json({ ok: true });
});

module.exports = router;
