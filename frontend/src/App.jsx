import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Employees from './components/Employees.jsx';
import Pointage from './components/Pointage.jsx';
import Calendrier from './components/Calendrier.jsx';
import Conges from './components/Conges.jsx';
import Rapport from './components/Rapport.jsx';
import Parametres from './components/Parametres.jsx';
import { DEVISES, useDevise } from './DeviseContext.jsx';

const ONGLETS = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'pointage', label: 'Pointage' },
  { id: 'calendrier', label: 'Calendrier' },
  { id: 'employes', label: 'Employes' },
  { id: 'conges', label: 'Conges' },
  { id: 'rapport', label: 'Rapport & Paie' },
  { id: 'parametres', label: 'Parametres' },
];

export default function App() {
  const [onglet, setOnglet] = useState('dashboard');
  const { devise, changerDevise } = useDevise();

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
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            className={`tab ${onglet === o.id ? 'active' : ''}`}
            onClick={() => setOnglet(o.id)}
          >
            {o.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {onglet === 'dashboard' && <Dashboard />}
        {onglet === 'pointage' && <Pointage />}
        {onglet === 'calendrier' && <Calendrier />}
        {onglet === 'employes' && <Employees />}
        {onglet === 'conges' && <Conges />}
        {onglet === 'rapport' && <Rapport />}
        {onglet === 'parametres' && <Parametres />}
      </main>
    </div>
  );
}
