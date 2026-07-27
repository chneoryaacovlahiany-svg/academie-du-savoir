const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('./db');

const { requireAuth, requireAdmin } = require('./middleware/auth');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const employeesRouter = require('./routes/employees');
const pointagesRouter = require('./routes/pointages');
const congesRouter = require('./routes/conges');
const rapportRouter = require('./routes/rapport');
const parametresRouter = require('./routes/parametres');
const baremeRouter = require('./routes/bareme');
const feriesRouter = require('./routes/feries');
const dashboardRouter = require('./routes/dashboard');
const horairesRouter = require('./routes/horaires');
const entrepriseRouter = require('./routes/entreprise');

const app = express();
const PORT = process.env.PORT || 4000;

// Necessaire derriere le proxy TLS d'un hebergeur (Render, etc.) pour que
// req.secure et req.ip refletent la vraie connexion du client, pas le proxy.
app.set('trust proxy', 1);

app.use(cors());
// Limite relevee pour accepter le logo de l'entreprise (encode en base64).
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);

app.use('/api/users', requireAuth, requireAdmin, usersRouter);
app.use('/api/employees', requireAuth, employeesRouter);
app.use('/api/pointages', requireAuth, pointagesRouter);
app.use('/api/conges', requireAuth, congesRouter);
app.use('/api/rapport', requireAuth, rapportRouter);
app.use('/api/parametres', requireAuth, requireAdmin, parametresRouter);
app.use('/api/bareme', requireAuth, requireAdmin, baremeRouter);
app.use('/api/feries', requireAuth, requireAdmin, feriesRouter);
app.use('/api/dashboard', requireAuth, requireAdmin, dashboardRouter);
app.use('/api/horaires', requireAuth, horairesRouter);
app.use('/api/entreprise', requireAuth, entrepriseRouter);

// En production, le build du frontend (frontend/dist) est servi directement
// par ce meme serveur: un seul service a heberger, meme origine que l'API
// (donc pas de souci de cookies cross-site).
//
// index.html, le manifest et le service worker ne doivent JAMAIS etre mis en
// cache par le navigateur: a chaque deploiement, Vite change le nom des
// fichiers JS/CSS (hash dans le nom), et les anciens sont supprimes. Un
// telephone qui garderait en cache une ancienne page ferait alors reference
// a des fichiers qui n'existent plus -> page blanche persistante, meme apres
// rechargement. Les fichiers sous /assets/ (nom hashe, change a chaque
// build) peuvent en revanche etre mis en cache sans risque.
const distDir = path.join(__dirname, '../frontend/dist');
const indexHtml = path.join(distDir, 'index.html');
app.use(
  express.static(distDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);
app.get(/^(?!\/api).*/, (req, res) => {
  if (!fs.existsSync(indexHtml)) {
    return res
      .status(404)
      .send('Frontend non compile: lancez "npm run build" dans frontend, ou utilisez "npm run dev" en developpement.');
  }
  res.set('Cache-Control', 'no-cache');
  res.sendFile(indexHtml);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

app.listen(PORT, () => {
  console.log(`API pointeuse demarree sur http://localhost:${PORT}`);
});
