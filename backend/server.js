const express = require('express');
const cors = require('cors');

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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

app.listen(PORT, () => {
  console.log(`API pointeuse demarree sur http://localhost:${PORT}`);
});
