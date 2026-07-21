import { useState } from 'react';
import Employees from './components/Employees.jsx';
import Pointage from './components/Pointage.jsx';
import Conges from './components/Conges.jsx';
import Rapport from './components/Rapport.jsx';

const ONGLETS = [
  { id: 'pointage', label: 'Pointage' },
  { id: 'employes', label: 'Employes' },
  { id: 'conges', label: 'Conges' },
  { id: 'rapport', label: 'Rapport & Paie' },
];

export default function App() {
  const [onglet, setOnglet] = useState('pointage');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pointeuse</h1>
        <p className="subtitle">Suivi des horaires, conges et paie des employes</p>
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
