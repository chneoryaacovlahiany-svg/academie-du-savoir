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
  'retards_tolerance_minutes',
  'retards_plafond_mensuel_minutes',
  'notif_entree_avant_minutes',
  'notif_entree_nb_rappels',
  'notif_entree_intervalle_minutes',
  'notif_sortie_nb_rappels',
  'notif_sortie_intervalle_minutes',
  'avertissements_retards_seuil',
];

const CLES_BOOLEENNES = [
  'retards_actif',
  'retards_plafond_mensuel_actif',
  'retards_rattrapage_actif',
  'notif_auto_actif',
  'notif_entree_avant_actif',
  'avertissements_retards_actif',
  'avertissements_email_actif',
  'email_conges_nouvelle_demande_actif',
  'email_conges_reponse_actif',
  'notif_conges_nouvelle_demande_actif',
  'notif_conges_reponse_actif',
];

const CLES_MESSAGES_AVERTISSEMENT = [1, 2, 3, 4, 5].map((n) => `avertissements_retards_message_${n}`);

// Une ou plusieurs IP separees par des virgules (ex: "88.12.34.56, 88.12.34.57").
function ipBureauValide(valeur) {
  if (valeur.trim() === '') return true;
  return valeur
    .split(',')
    .map((ip) => ip.trim())
    .every((ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every((o) => Number(o) <= 255));
}

// Une ou plusieurs durees en minutes separees par des virgules (ex: "20,30,40").
function optionsReportValide(valeur) {
  if (valeur.trim() === '') return true;
  return valeur
    .split(',')
    .map((m) => m.trim())
    .every((m) => /^\d+$/.test(m) && Number(m) > 0);
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
  if (req.body.notif_sortie_options_report !== undefined) {
    if (!optionsReportValide(req.body.notif_sortie_options_report)) {
      return res.status(400).json({ error: 'Valeur invalide pour notif_sortie_options_report (minutes entieres separees par des virgules)' });
    }
    maj.run('notif_sortie_options_report', req.body.notif_sortie_options_report.trim());
  }
  for (const cle of CLES_MESSAGES_AVERTISSEMENT) {
    if (req.body[cle] !== undefined) {
      const valeur = String(req.body[cle]).trim();
      if (!valeur) {
        return res.status(400).json({ error: `Le message ne peut pas etre vide (${cle})` });
      }
      maj.run(cle, valeur);
    }
  }
  for (const cle of CLES_BOOLEENNES) {
    if (req.body[cle] !== undefined) {
      maj.run(cle, req.body[cle] ? '1' : '0');
    }
  }
  res.json(chargerParametres());
});

module.exports = router;
