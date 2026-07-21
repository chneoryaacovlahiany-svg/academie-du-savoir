const express = require('express');
const db = require('../db');

const router = express.Router();

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
  const { nom, prenom, poste, taux_horaire, solde_conges } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ error: 'Le nom et le prenom sont requis' });
  }
  const tauxHoraire = Number(taux_horaire) || 0;
  if (tauxHoraire < 0) {
    return res.status(400).json({ error: 'Le taux horaire doit etre positif' });
  }
  const info = db
    .prepare(
      `INSERT INTO employees (nom, prenom, poste, taux_horaire, solde_conges)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(nom, prenom, poste || '', tauxHoraire, Number(solde_conges) || 0);
  const created = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employe introuvable' });

  const nom = req.body.nom ?? existing.nom;
  const prenom = req.body.prenom ?? existing.prenom;
  const poste = req.body.poste ?? existing.poste;
  const taux_horaire = req.body.taux_horaire !== undefined ? Number(req.body.taux_horaire) : existing.taux_horaire;
  const solde_conges = req.body.solde_conges !== undefined ? Number(req.body.solde_conges) : existing.solde_conges;
  const actif = req.body.actif !== undefined ? (req.body.actif ? 1 : 0) : existing.actif;

  db.prepare(
    `UPDATE employees SET nom = ?, prenom = ?, poste = ?, taux_horaire = ?, solde_conges = ?, actif = ?
     WHERE id = ?`
  ).run(nom, prenom, poste, taux_horaire, solde_conges, actif, req.params.id);

  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Employe introuvable' });
  res.status(204).end();
});

module.exports = router;
