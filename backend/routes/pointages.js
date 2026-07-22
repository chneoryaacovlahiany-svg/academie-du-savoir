const express = require('express');
const db = require('../db');
const { dateLocale } = require('../calculs');
const { chargerParametres } = require('../soldes');

const router = express.Router();

function todayDate() {
  return dateLocale();
}

function nowTime() {
  return new Date().toISOString();
}

function computeHeures(entree, sortie) {
  const diffMs = new Date(sortie).getTime() - new Date(entree).getTime();
  return Math.max(0, diffMs / 1000 / 60 / 60);
}

// IP du client, en retirant le prefixe IPv4-mapped-IPv6 eventuel (::ffff:1.2.3.4).
function ipClient(req) {
  return (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

// Verifie que l'IP du client correspond a l'une des IP de bureau configurees
// dans Parametres. Si aucune IP n'est configuree, la restriction est
// desactivee (aucun blocage) pour ne pas bloquer un compte non configure.
function ipBureauAutorisee(req) {
  const ipBureau = (chargerParametres().ip_bureau || '').trim();
  if (!ipBureau) return true;
  const ipsAutorisees = ipBureau.split(',').map((ip) => ip.trim());
  return ipsAutorisees.includes(ipClient(req));
}

// Statut du jour pour un employe (pointe ou non)
router.get('/statut/:employeeId', (req, res) => {
  const date = req.query.date || todayDate();
  const row = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(req.params.employeeId, date);
  res.json(row || null);
});

// Liste des pointages avec filtres optionnels
router.get('/', (req, res) => {
  const { employee_id, debut, fin } = req.query;
  let query = 'SELECT * FROM pointages WHERE 1=1';
  const params = [];
  if (employee_id) {
    query += ' AND employee_id = ?';
    params.push(employee_id);
  }
  if (debut) {
    query += ' AND date >= ?';
    params.push(debut);
  }
  if (fin) {
    query += ' AND date <= ?';
    params.push(fin);
  }
  query += ' ORDER BY date DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// Pointage entree
router.post('/entree', (req, res) => {
  const { employee_id, date, lieu } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id requis' });

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employe introuvable' });

  // Un pointage declare "bureau" doit provenir du reseau du bureau (IP configuree
  // dans Parametres); un pointage "domicile" n'est pas restreint.
  if (lieu === 'bureau' && !ipBureauAutorisee(req)) {
    return res.status(403).json({
      error: 'Pointage "bureau" refuse: cette connexion ne provient pas du reseau du bureau.',
    });
  }

  const jour = date || todayDate();
  const existing = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(employee_id, jour);

  if (existing && existing.heure_entree && !existing.heure_sortie) {
    return res.status(409).json({ error: 'Cet employe est deja pointe en entree aujourd\'hui' });
  }

  const heure = nowTime();
  const lieuFinal = lieu || null;
  if (existing) {
    db.prepare('UPDATE pointages SET heure_entree = ?, heure_sortie = NULL, heures_travaillees = NULL, lieu = ? WHERE id = ?').run(
      heure,
      lieuFinal,
      existing.id
    );
  } else {
    db.prepare(
      'INSERT INTO pointages (employee_id, date, heure_entree, lieu) VALUES (?, ?, ?, ?)'
    ).run(employee_id, jour, heure, lieuFinal);
  }

  const result = db.prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?').get(employee_id, jour);
  res.status(201).json(result);
});

// Pointage sortie
router.post('/sortie', (req, res) => {
  const { employee_id, date } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id requis' });

  const jour = date || todayDate();
  const existing = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(employee_id, jour);

  if (!existing || !existing.heure_entree) {
    return res.status(409).json({ error: 'Aucune entree enregistree pour aujourd\'hui' });
  }
  if (existing.heure_sortie) {
    return res.status(409).json({ error: 'Cet employe est deja pointe en sortie aujourd\'hui' });
  }

  const heure = nowTime();
  const heures = computeHeures(existing.heure_entree, heure);
  db.prepare('UPDATE pointages SET heure_sortie = ?, heures_travaillees = ? WHERE id = ?').run(
    heure,
    heures,
    existing.id
  );

  const result = db.prepare('SELECT * FROM pointages WHERE id = ?').get(existing.id);
  res.json(result);
});

// Ajout ou correction manuelle par un administrateur (pour un employe/jour donne)
// Correction admin: pas de verification d'IP (il ne s'agit pas d'un pointage en direct).
router.post('/manuel', (req, res) => {
  const { employee_id, date, heure_entree, heure_sortie, lieu } = req.body;
  if (!employee_id || !date) {
    return res.status(400).json({ error: 'employee_id et date sont requis' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employe introuvable' });

  const heures_travaillees =
    heure_entree && heure_sortie ? computeHeures(heure_entree, heure_sortie) : null;

  const existing = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?')
    .get(employee_id, date);

  if (existing) {
    db.prepare(
      'UPDATE pointages SET heure_entree = ?, heure_sortie = ?, heures_travaillees = ?, lieu = ? WHERE id = ?'
    ).run(heure_entree || null, heure_sortie || null, heures_travaillees, lieu || null, existing.id);
  } else {
    db.prepare(
      'INSERT INTO pointages (employee_id, date, heure_entree, heure_sortie, heures_travaillees, lieu) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(employee_id, date, heure_entree || null, heure_sortie || null, heures_travaillees, lieu || null);
  }

  const result = db.prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?').get(employee_id, date);
  res.json(result);
});

// Correction manuelle par un administrateur
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pointages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pointage introuvable' });

  const heure_entree = req.body.heure_entree ?? existing.heure_entree;
  const heure_sortie = req.body.heure_sortie !== undefined ? req.body.heure_sortie : existing.heure_sortie;
  const lieu = req.body.lieu !== undefined ? req.body.lieu : existing.lieu;
  const heures_travaillees =
    heure_entree && heure_sortie ? computeHeures(heure_entree, heure_sortie) : null;

  db.prepare(
    'UPDATE pointages SET heure_entree = ?, heure_sortie = ?, heures_travaillees = ?, lieu = ? WHERE id = ?'
  ).run(heure_entree, heure_sortie, heures_travaillees, lieu, req.params.id);

  const updated = db.prepare('SELECT * FROM pointages WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM pointages WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Pointage introuvable' });
  res.status(204).end();
});

module.exports = router;
