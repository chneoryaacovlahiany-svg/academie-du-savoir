import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Employees from './components/Employees.jsx';
import Pointage from './components/Pointage.jsx';
import Calendrier from './components/Calendrier.jsx';
import Conges from './components/Conges.jsx';
import Rapport from './components/Rapport.jsx';
import Parametres from './components/Parametres.jsx';
import Comptes from './components/Comptes.jsx';
import MonCompte from './components/MonCompte.jsx';
import Login from './components/Login.jsx';
import { DEVISES, useDevise } from './DeviseContext.jsx';
import { useAuth } from './AuthContext.jsx';

const ONGLETS_ADMIN = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'pointage', label: 'Pointage' },
  { id: 'calendrier', label: 'Calendrier' },
  { id: 'employes', label: 'Employes' },
  { id: 'conges', label: 'Conges' },
  { id: 'rapport', label: 'Rapport & Paie' },
  { id: 'parametres', label: 'Parametres' },
  { id: 'comptes', label: 'Comptes' },
  { id: 'mon-compte', label: 'Mon compte' },
];

const ONGLETS_EMPLOYE = [
  { id: 'pointage', label: 'Pointage' },
  { id: 'calendrier', label: 'Calendrier' },
  { id: 'conges', label: 'Conges' },
  { id: 'mon-compte', label: 'Mon compte' },
];

export default function App() {
  const { user, chargement } = useAuth();
  const [onglet, setOnglet] = useState('dashboard');
  const { devise, changerDevise } = useDevise();

  if (chargement) {
    return <div className="app">Chargement...</div>;
  }

  if (!user) {
    return <Login />;
  }

  const onglets = user.role === 'admin' ? ONGLETS_ADMIN : ONGLETS_EMPLOYE;
  const ongletActif = onglets.some((o) => o.id === onglet) ? onglet : onglets[0].id;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Pointeuse</h1>
          <p className="subtitle">Suivi des horaires, conges et paie des employes</p>
        </div>
        <label className="selecteur-devise">
          Devise:{' '}
          <select value={devise.code} onChange={(e) => changerDevise(e.target.value)}>
            {DEVISES.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="tabs">
        {onglets.map((o) => (
          <button
            key={o.id}
            className={`tab ${ongletActif === o.id ? 'active' : ''}`}
            onClick={() => setOnglet(o.id)}
          >
            {o.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {ongletActif === 'dashboard' && <Dashboard />}
        {ongletActif === 'pointage' && <Pointage />}
        {ongletActif === 'calendrier' && <Calendrier />}
        {ongletActif === 'employes' && <Employees />}
        {ongletActif === 'conges' && <Conges />}
        {ongletActif === 'rapport' && <Rapport />}
        {ongletActif === 'parametres' && <Parametres />}
        {ongletActif === 'comptes' && <Comptes />}
        {ongletActif === 'mon-compte' && <MonCompte />}
      </main>
    </div>
  );
}
