const express = require('express');
const db = require('../db');

const router = express.Router();

const SEMAINES_PAR_MOIS = 52 / 12;

function resoudreRemuneration(body, existant) {
  const type_paie = body.type_paie !== undefined ? body.type_paie : existant?.type_paie || 'horaire';

  if (type_paie === 'mensuel') {
    const salaire_mensuel =
      body.salaire_mensuel !== undefined ? Number(body.salaire_mensuel) : existant?.salaire_mensuel;
    const heures_semaine =
      body.heures_semaine !== undefined ? Number(body.heures_semaine) : existant?.heures_semaine;

    if (!salaire_mensuel || salaire_mensuel <= 0 || !heures_semaine || heures_semaine <= 0) {
      return { erreur: 'Le salaire mensuel et les heures par semaine doivent etre renseignes et positifs' };
    }

    const heuresMensuelles = heures_semaine * SEMAINES_PAR_MOIS;
    const taux_horaire = salaire_mensuel / heuresMensuelles;

    return { type_paie, taux_horaire, salaire_mensuel, heures_semaine };
  }

  const taux_horaire =
    body.taux_horaire !== undefined ? Number(body.taux_horaire) : existant?.taux_horaire || 0;
  if (taux_horaire < 0) {
    return { erreur: 'Le taux horaire doit etre positif' };
  }

  return { type_paie: 'horaire', taux_horaire, salaire_mensuel: null, heures_semaine: null };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM employees ORDER BY nom, prenom').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Employe introuvable' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { nom, prenom, poste, solde_conges } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ error: 'Le nom et le prenom sont requis' });
  }

  const remuneration = resoudreRemuneration(req.body, null);
  if (remuneration.erreur) {
    return res.status(400).json({ error: remuneration.erreur });
  }

  const info = db
    .prepare(
      `INSERT INTO employees (nom, prenom, poste, type_paie, taux_horaire, salaire_mensuel, heures_semaine, solde_conges)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nom,
      prenom,
      poste || '',
      remuneration.type_paie,
      remuneration.taux_horaire,
      remuneration.salaire_mensuel,
      remuneration.heures_semaine,
      Number(solde_conges) || 0
    );
  const created = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employe introuvable' });

  const nom = req.body.nom ?? existing.nom;
  const prenom = req.body.prenom ?? existing.prenom;
  const poste = req.body.poste ?? existing.poste;
  const solde_conges = req.body.solde_conges !== undefined ? Number(req.body.solde_conges) : existing.solde_conges;
  const actif = req.body.actif !== undefined ? (req.body.actif ? 1 : 0) : existing.actif;

  const remuneration = resoudreRemuneration(req.body, existing);
  if (remuneration.erreur) {
    return res.status(400).json({ error: remuneration.erreur });
  }

  db.prepare(
    `UPDATE employees SET nom = ?, prenom = ?, poste = ?, type_paie = ?, taux_horaire = ?,
     salaire_mensuel = ?, heures_semaine = ?, solde_conges = ?, actif = ?
     WHERE id = ?`
  ).run(
    nom,
    prenom,
    poste,
    remuneration.type_paie,
    remuneration.taux_horaire,
    remuneration.salaire_mensuel,
    remuneration.heures_semaine,
    solde_conges,
    actif,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Employe introuvable' });
  res.status(204).end();
});

module.exports = router;
