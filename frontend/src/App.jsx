import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Employees from './components/Employees.jsx';
import Pointage from './components/Pointage.jsx';
import Calendrier from './components/Calendrier.jsx';
import Conges from './components/Conges.jsx';
import Avertissements from './components/Avertissements.jsx';
import Rapport from './components/Rapport.jsx';
import Parametres from './components/Parametres.jsx';
import Comptes from './components/Comptes.jsx';
import MonCompte from './components/MonCompte.jsx';
import Login from './components/Login.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import NotificationsAdmin from './components/NotificationsAdmin.jsx';
import SelecteurIcone from './components/SelecteurIcone.jsx';
import { DEVISES, useDevise } from './DeviseContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { EntrepriseProvider, useEntreprise } from './EntrepriseContext.jsx';
import { useLangue, LANGUES } from './LangueContext.jsx';

function initialesUtilisateur(user) {
  if (user?.employee) return `${user.employee.prenom[0]}${user.employee.nom[0]}`.toUpperCase();
  return (user?.email || '?')[0].toUpperCase();
}

function EnteteApp({ user, onOuvrirMonCompte }) {
  const { entreprise } = useEntreprise();
  const { devise, changerDevise } = useDevise();
  const { t, langue, changerLangue } = useLangue();

  return (
    <header className="app-header">
      <div className="app-header-identite">
        {entreprise.logo && <img src={entreprise.logo} alt="Logo" className="app-header-logo" />}
        <div>
          <h1>{entreprise.nom || t('header.appName')}</h1>
          <p className="subtitle">{t('header.subtitle')}</p>
        </div>
      </div>
      <div className="app-header-actions">
        <SelecteurIcone
          icone="🌐"
          titre={t('header.langue')}
          valeurAffichee={langue.toUpperCase()}
          valeurActuelle={langue}
          onChanger={changerLangue}
          options={LANGUES.map((l) => ({ value: l.code, label: l.label }))}
        />
        <SelecteurIcone
          icone="💱"
          titre={t('header.devise')}
          valeurAffichee={devise.symbole}
          valeurActuelle={devise.code}
          onChanger={changerDevise}
          options={DEVISES.map((d) => ({ value: d.code, label: `${d.symbole} ${t(`common.${{ EUR: 'deviseEuro', USD: 'deviseDollar', ILS: 'deviseShekel' }[d.code]}`)}` }))}
        />
        {user.role === 'admin' && <NotificationsAdmin />}
        <NotificationBell />
        <button
          type="button"
          className="avatar-utilisateur"
          onClick={onOuvrirMonCompte}
          title={t('tabs.monCompte')}
        >
          {initialesUtilisateur(user)}
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const { user, chargement } = useAuth();
  const [onglet, setOnglet] = useState('dashboard');
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { t } = useLangue();

  const ONGLETS_ADMIN = [
    { id: 'dashboard', icone: '📊', label: t('tabs.dashboard') },
    { id: 'pointage', icone: '⏱️', label: t('tabs.pointage') },
    { id: 'calendrier', icone: '📅', label: t('tabs.calendrier') },
    { id: 'employes', icone: '👥', label: t('tabs.employes') },
    { id: 'conges', icone: '🌴', label: t('tabs.conges') },
    { id: 'rapport', icone: '💰', label: t('tabs.rapport') },
    { id: 'avertissements', icone: '⚠️', label: t('tabs.avertissements') },
    { id: 'parametres', icone: '⚙️', label: t('tabs.parametres') },
    { id: 'comptes', icone: '🔑', label: t('tabs.comptes') },
  ];

  const ONGLETS_EMPLOYE = [
    { id: 'pointage', icone: '⏱️', label: t('tabs.pointage') },
    { id: 'calendrier', icone: '📅', label: t('tabs.calendrier') },
    { id: 'conges', icone: '🌴', label: t('tabs.conges') },
    { id: 'rapport', icone: '💰', label: t('tabs.fichesPaie') },
    { id: 'avertissements', icone: '⚠️', label: t('tabs.avertissements') },
  ];

  if (chargement) {
    return <div className="app">{t('common.loading')}</div>;
  }

  if (!user) {
    return <Login />;
  }

  const onglets = user.role === 'admin' ? ONGLETS_ADMIN : ONGLETS_EMPLOYE;
  const ongletActif =
    onglet === 'mon-compte' || onglets.some((o) => o.id === onglet) ? onglet : onglets[0].id;

  return (
    <EntrepriseProvider>
      <div className="app">
        <EnteteApp user={user} onOuvrirMonCompte={() => setOnglet('mon-compte')} />

        <div className="app-corps">
          <nav className={`sidebar ${menuOuvert ? 'sidebar-ouvert' : 'sidebar-replie'}`}>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setMenuOuvert(!menuOuvert)}
              title={t('tabs.reduireMenu')}
              aria-label={t('tabs.reduireMenu')}
            >
              ☰
            </button>
            {onglets.map((o) => (
              <button
                key={o.id}
                className={`sidebar-item ${ongletActif === o.id ? 'active' : ''}`}
                onClick={() => setOnglet(o.id)}
                title={o.label}
              >
                <span className="sidebar-icone" aria-hidden="true">{o.icone}</span>
                {menuOuvert && <span className="sidebar-label">{o.label}</span>}
              </button>
            ))}
          </nav>

          <main className="content">
            <ErrorBoundary key={ongletActif}>
              {ongletActif === 'dashboard' && <Dashboard />}
              {ongletActif === 'pointage' && <Pointage />}
              {ongletActif === 'calendrier' && <Calendrier />}
              {ongletActif === 'employes' && <Employees />}
              {ongletActif === 'conges' && <Conges />}
              {ongletActif === 'rapport' && <Rapport />}
              {ongletActif === 'avertissements' && <Avertissements />}
              {ongletActif === 'parametres' && <Parametres />}
              {ongletActif === 'comptes' && <Comptes />}
              {ongletActif === 'mon-compte' && <MonCompte />}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </EntrepriseProvider>
  );
}
