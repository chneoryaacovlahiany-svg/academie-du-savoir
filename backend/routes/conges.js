const express = require('express');
const db = require('../db');

const router = express.Router();

const TYPES_VALIDES = ['conge_paye', 'sans_solde', 'maladie', 'autre'];
const STATUTS_VALIDES = ['en_attente', 'approuve', 'refuse'];

function nbJoursEntre(debut, fin) {
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  return diff + 1;
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
  res.json(db.prepare(query).all(...params));
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

  res.status(201).json(db.prepare('SELECT * FROM conges WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id/statut', (req, res) => {
  const { statut } = req.body;
  if (!STATUTS_VALIDES.includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  const conge = db.prepare('SELECT * FROM conges WHERE id = ?').get(req.params.id);
  if (!conge) return res.status(404).json({ error: 'Conge introuvable' });

  const statutPrecedent = conge.statut;

  db.prepare('UPDATE conges SET statut = ? WHERE id = ?').run(statut, req.params.id);

  if (conge.type === 'conge_paye') {
    if (statut === 'approuve' && statutPrecedent !== 'approuve') {
      db.prepare('UPDATE employees SET solde_conges = solde_conges - ? WHERE id = ?').run(
        conge.nb_jours,
        conge.employee_id
      );
    } else if (statutPrecedent === 'approuve' && statut !== 'approuve') {
      db.prepare('UPDATE employees SET solde_conges = solde_conges + ? WHERE id = ?').run(
        conge.nb_jours,
        conge.employee_id
      );
    }
  }

  res.json(db.prepare('SELECT * FROM conges WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const conge = db.prepare('SELECT * FROM conges WHERE id = ?').get(req.params.id);
  if (!conge) return res.status(404).json({ error: 'Conge introuvable' });

  if (conge.type === 'conge_paye' && conge.statut === 'approuve') {
    db.prepare('UPDATE employees SET solde_conges = solde_conges + ? WHERE id = ?').run(
      conge.nb_jours,
      conge.employee_id
    );
  }

  db.prepare('DELETE FROM conges WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
