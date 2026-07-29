const express = require('express');
const db = require('../db');
const { vapidKeys } = require('../vapid');
const { dateLocale } = require('../calculs');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/cle-publique', (req, res) => {
  res.json({ cle_publique: vapidKeys.publicKey });
});

// Nombre d'appareils reellement abonnes par employe, reserve aux admins: sert
// a diagnostiquer pourquoi un employe ne recoit pas de rappel serveur (permission
// de notification accordee cote navigateur ne veut pas dire abonnement enregistre;
// un meme appareil ne garde qu'un seul abonnement actif, qui peut se faire
// reattribuer d'un compte a l'autre si plusieurs sont testes dessus).
router.get('/abonnements', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT employee_id, COUNT(*) as nb FROM push_subscriptions GROUP BY employee_id').all();
  res.json(rows);
});

// Enregistre (ou met a jour) l'abonnement push de l'employe connecte pour cet
// appareil. Un meme employe peut avoir plusieurs abonnements (plusieurs
// appareils): chacun recoit les rappels.
router.post('/abonnement', (req, res) => {
  const employeeId = req.user.role === 'employe' ? req.user.employee_id : req.body.employee_id;
  if (!employeeId) {
    return res.status(400).json({ error: "Ce compte n'est pas lie a un employe" });
  }
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Abonnement push invalide" });
  }
  db.prepare(
    `INSERT INTO push_subscriptions (employee_id, endpoint, cle_p256dh, cle_auth) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET employee_id = excluded.employee_id, cle_p256dh = excluded.cle_p256dh, cle_auth = excluded.cle_auth`
  ).run(employeeId, endpoint, keys.p256dh, keys.auth);
  res.status(201).json({ ok: true });
});

router.delete('/abonnement', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint requis' });
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.status(204).end();
});

// Reporte le prochain rappel (bouton "+20/30/40 min" sur la notification),
// sans incrementer le compteur de rappels deja envoyes: la sequence reprend
// simplement plus tard.
router.post('/reporter', (req, res) => {
  const employeeId = req.user.role === 'employe' ? req.user.employee_id : req.body.employee_id;
  const { type, minutes } = req.body;
  if (!employeeId || !['entree', 'sortie'].includes(type) || !Number(minutes) || Number(minutes) <= 0) {
    return res.status(400).json({ error: 'Parametres invalides' });
  }
  const date = dateLocale();
  const prochainEnvoi = new Date(Date.now() + Number(minutes) * 60000).toISOString();
  db.prepare(
    `INSERT INTO rappels_etat (employee_id, date, type, nb_envoyes, prochain_envoi) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(employee_id, date, type) DO UPDATE SET prochain_envoi = excluded.prochain_envoi`
  ).run(employeeId, date, type, prochainEnvoi);
  res.json({ ok: true });
});

module.exports = router;
