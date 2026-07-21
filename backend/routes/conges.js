const express = require('express');
const db = require('../db');
const { montantMaladiePourAbsence } = require('../calculs');
const { chargerParametres } = require('../soldes');

const router = express.Router();

const TYPES_VALIDES = ['conge_paye', 'sans_solde', 'maladie', 'autre'];
const STATUTS_VALIDES = ['en_attente', 'approuve', 'refuse'];

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

router.get('/', (req, res) => {
  const { employee_id, statut } = req.query;
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

router.post('/', (req, res) => {
  const { employee_id, date_debut, date_fin, type, commentaire } = req.body;
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
});

router.put('/:id/statut', (req, res) => {
  const { statut } = req.body;
  if (!STATUTS_VALIDES.includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  const conge = db.prepare('SELECT * FROM conges WHERE id = ?').get(req.params.id);
  if (!conge) return res.status(404).json({ error: 'Conge introuvable' });

  db.prepare('UPDATE conges SET statut = ? WHERE id = ?').run(statut, req.params.id);

  const updated = db.prepare('SELECT * FROM conges WHERE id = ?').get(req.params.id);
  res.json(ajouterMontantMaladie(updated));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM conges WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Conge introuvable' });
  res.status(204).end();
});

module.exports = router;
