const express = require('express');
const cors = require('cors');

require('./db');

const employeesRouter = require('./routes/employees');
const pointagesRouter = require('./routes/pointages');
const congesRouter = require('./routes/conges');
const rapportRouter = require('./routes/rapport');
const parametresRouter = require('./routes/parametres');
const baremeRouter = require('./routes/bareme');
const feriesRouter = require('./routes/feries');
const dashboardRouter = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/employees', employeesRouter);
app.use('/api/pointages', pointagesRouter);
app.use('/api/conges', congesRouter);
app.use('/api/rapport', rapportRouter);
app.use('/api/parametres', parametresRouter);
app.use('/api/bareme', baremeRouter);
app.use('/api/feries', feriesRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

app.listen(PORT, () => {
  console.log(`API pointeuse demarree sur http://localhost:${PORT}`);
});
