const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Meme convention que db.js/vapid.js: stocke les fichiers sur le disque
// persistant (DATA_DIR chez Render) plutot que dans le dossier du code, qui
// est efface a chaque deploiement.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
const dossierFichesPaie = path.join(dataDir, 'fiches_paie');
fs.mkdirSync(dossierFichesPaie, { recursive: true });

// Un employe ne voit/telecharge que ses propres fiches (jamais celles d'un
// autre, meme pour un admin qui passerait un autre employee_id en query);
// l'admin peut tout voir ou filtrer par employe via ?employee_id=.
router.get('/', (req, res) => {
  let { employee_id } = req.query;
  if (req.user.role === 'employe') {
    employee_id = req.user.employee_id;
  }
  let requete = `SELECT f.id, f.employee_id, f.mois, f.nom_fichier, f.date_upload, e.nom, e.prenom
                 FROM fiches_paie f JOIN employees e ON e.id = f.employee_id WHERE 1 = 1`;
  const params = [];
  if (employee_id) {
    requete += ' AND f.employee_id = ?';
    params.push(employee_id);
  }
  requete += ' ORDER BY f.mois DESC, f.date_upload DESC';
  res.json(db.prepare(requete).all(...params));
});

// Upload d'une fiche de paie (PDF encode en base64, sur le meme principe que
// le logo de la societe): reserve a l'admin.
router.post('/', requireAdmin, (req, res) => {
  const { employee_id, mois, nom_fichier, contenu_base64 } = req.body;
  if (!employee_id || !mois || !nom_fichier || !contenu_base64) {
    return res.status(400).json({ error: 'employee_id, mois, nom_fichier et contenu_base64 sont requis' });
  }
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employe introuvable' });

  const donnees = Buffer.from(contenu_base64.replace(/^data:.*;base64,/, ''), 'base64');
  const nomStocke = `${employee_id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
  const cheminComplet = path.join(dossierFichesPaie, nomStocke);
  fs.writeFileSync(cheminComplet, donnees);

  const resultat = db
    .prepare('INSERT INTO fiches_paie (employee_id, mois, nom_fichier, chemin_fichier) VALUES (?, ?, ?, ?)')
    .run(employee_id, mois, nom_fichier, nomStocke);

  res.status(201).json({ id: Number(resultat.lastInsertRowid), employee_id, mois, nom_fichier });
});

router.get('/:id/telecharger', (req, res) => {
  const fiche = db.prepare('SELECT * FROM fiches_paie WHERE id = ?').get(req.params.id);
  if (!fiche) return res.status(404).json({ error: 'Fiche introuvable' });
  if (req.user.role === 'employe' && fiche.employee_id !== req.user.employee_id) {
    return res.status(403).json({ error: 'Acces refuse' });
  }
  const cheminComplet = path.join(dossierFichesPaie, fiche.chemin_fichier);
  if (!fs.existsSync(cheminComplet)) return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
  res.download(cheminComplet, fiche.nom_fichier);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const fiche = db.prepare('SELECT * FROM fiches_paie WHERE id = ?').get(req.params.id);
  if (!fiche) return res.status(404).json({ error: 'Fiche introuvable' });
  fs.rm(path.join(dossierFichesPaie, fiche.chemin_fichier), { force: true }, () => {});
  db.prepare('DELETE FROM fiches_paie WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
