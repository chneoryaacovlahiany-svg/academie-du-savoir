import { useState } from 'react';
import Employees from './components/Employees.jsx';
import Pointage from './components/Pointage.jsx';
import Conges from './components/Conges.jsx';
import Rapport from './components/Rapport.jsx';
import { DEVISES, useDevise } from './DeviseContext.jsx';

const ONGLETS = [
  { id: 'pointage', label: 'Pointage' },
  { id: 'employes', label: 'Employes' },
  { id: 'conges', label: 'Conges' },
  { id: 'rapport', label: 'Rapport & Paie' },
];

export default function App() {
  const [onglet, setOnglet] = useState('pointage');
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
        {onglet === 'pointage' && <Pointage />}
        {onglet === 'employes' && <Employees />}
        {onglet === 'conges' && <Conges />}
        {onglet === 'rapport' && <Rapport />}
      </main>
    </div>
  );
}
