const express = require('express');
const db = require('../db');
const { montantMaladiePourAbsence } = require('../calculs');
const { chargerParametres } = require('../soldes');
const { requireAdmin } = require('../middleware/auth');
const { envoyerEmail } = require('../email');
const { chargerInfosEntreprise } = require('./entreprise');
const { envoyerPushAEmploye } = require('../scheduler');

const router = express.Router();

const TYPES_VALIDES = ['conge_paye', 'sans_solde', 'maladie', 'autre'];
const STATUTS_VALIDES = ['en_attente', 'approuve', 'refuse'];
const LIBELLES_TYPE = { conge_paye: 'Conge paye', sans_solde: 'Sans solde', maladie: 'Maladie', autre: 'Autre' };
const LIBELLES_STATUT = { approuve: 'approuvee', refuse: 'refusee' };

function nbJoursEntre(debut, fin) {
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  return diff + 1;
}

function ajouterMontantMaladie(conge) {
  if (conge.type !== 'maladie') return conge;
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(conge.employee_id);
  if (!employee) return conge;
  const params = chargerParametres();
  const montant_estime = montantMaladiePourAbsence(
    conge.nb_jours,
    employee.taux_horaire,
    params.heures_standard_jour
  );
  return { ...conge, montant_estime: Math.round(montant_estime * 100) / 100 };
}

// Un compte employe ne voit que ses propres demandes, quel que soit le filtre envoye.
router.get('/', (req, res) => {
  const { statut } = req.query;
  const employee_id = req.user.role === 'employe' ? req.user.employee_id : req.query.employee_id;
  let query = 'SELECT * FROM conges WHERE 1=1';
  const params = [];
  if (employee_id) {
    query += ' AND employee_id = ?';
    params.push(employee_id);
  }
  if (statut) {
    query += ' AND statut = ?';
    params.push(statut);
  }
  query += ' ORDER BY date_debut DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows.map(ajouterMontantMaladie));
});

// Un compte employe ne peut demander un conge que pour lui-meme.
router.post('/', (req, res) => {
  const employee_id = req.user.role === 'employe' ? req.user.employee_id : req.body.employee_id;
  const { date_debut, date_fin, type, commentaire } = req.body;
  if (!employee_id || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'employee_id, date_debut et date_fin sont requis' });
  }
  if (new Date(date_fin) < new Date(date_debut)) {
    return res.status(400).json({ error: 'La date de fin doit etre apres la date de debut' });
  }
  const congeType = TYPES_VALIDES.includes(type) ? type : 'conge_paye';
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employe introuvable' });

  const nb_jours = nbJoursEntre(date_debut, date_fin);

  const info = db
    .prepare(
      `INSERT INTO conges (employee_id, date_debut, date_fin, type, statut, nb_jours, commentaire)
       VALUES (?, ?, ?, ?, 'en_attente', ?, ?)`
    )
    .run(employee_id, date_debut, date_fin, congeType, nb_jours, commentaire || '');

  const conge = db.prepare('SELECT * FROM conges WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(ajouterMontantMaladie(conge));

  const params = chargerParametres();
  if (params.email_conges_nouvelle_demande_actif) {
    const entreprise = chargerInfosEntreprise();
    if (entreprise.email) {
      envoyerEmail(
        entreprise.email,
        `Nouvelle demande de conge - ${employee.prenom} ${employee.nom}`,
        `${employee.prenom} ${employee.nom} a soumis une demande de conge (${LIBELLES_TYPE[congeType]}) du ${date_debut} au ${date_fin} (${nb_jours} jour(s)).${
          commentaire ? `\n\nCommentaire: ${commentaire}` : ''
        }`
      );
    }
  }
  if (params.notif_conges_nouvelle_demande_actif) {
    // Un admin ne peut recevoir de notification push que si son compte est
    // lie a une fiche employe (meme mecanisme d'abonnement que les employes):
    // sans ce lien, il n'y a aucun appareil connu ou envoyer la notification.
    const adminsAvecEmploye = db
      .prepare("SELECT DISTINCT employee_id FROM users WHERE role = 'admin' AND employee_id IS NOT NULL")
      .all();
    for (const { employee_id: adminEmployeeId } of adminsAvecEmploye) {
      envoyerPushAEmploye(
        adminEmployeeId,
        'Pointeuse',
        `${employee.prenom} ${employee.nom} a soumis une demande de conge du ${date_debut} au ${date_fin}.`,
        'conge_nouvelle_demande'
      );
    }
  }
});

router.put('/:id/statut', requireAdmin, (req, res) => {
  const { statut } = req.body;
  if (!STATUTS_VALIDES.includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  const conge = db.prepare('SELECT * FROM conges WHERE id = ?').get(req.params.id);
  if (!conge) return res.status(404).json({ error: 'Conge introuvable' });

  db.prepare('UPDATE conges SET statut = ? WHERE id = ?').run(statut, req.params.id);

  const updated = db.prepare('SELECT * FROM conges WHERE id = ?').get(req.params.id);
  res.json(ajouterMontantMaladie(updated));

  const params = chargerParametres();
  if ((params.email_conges_reponse_actif || params.notif_conges_reponse_actif) && (statut === 'approuve' || statut === 'refuse')) {
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(conge.employee_id);
    const texte = `Votre demande de conge (${LIBELLES_TYPE[conge.type]}) du ${conge.date_debut} au ${conge.date_fin} a ete ${LIBELLES_STATUT[statut]}.`;
    if (params.email_conges_reponse_actif && employee?.email) {
      envoyerEmail(employee.email, 'Reponse a votre demande de conge', texte);
    }
    if (params.notif_conges_reponse_actif && employee) {
      envoyerPushAEmploye(employee.id, 'Pointeuse', texte, 'conge_reponse');
    }
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM conges WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Conge introuvable' });
  res.status(204).end();
});

module.exports = router;
