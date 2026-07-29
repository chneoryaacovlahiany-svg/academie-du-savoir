import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useLangue } from '../LangueContext.jsx';

const INTERVALLE_RAFRAICHISSEMENT_MS = 60000;

// Vue de supervision admin: historique des notifications de tous les
// employes (rappels, avertissements, conges), distincte de la cloche
// personnelle qui reste strictement limitee a l'employe connecte.
export default function NotificationsAdmin() {
  const { t, locale } = useLangue();
  const [notifications, setNotifications] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeFiltre, setEmployeeFiltre] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef(null);

  useEffect(() => {
    api.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    const charger = () => {
      api.getNotificationsAdmin(employeeFiltre || undefined).then(setNotifications).catch(() => {});
    };
    charger();
    const intervalle = setInterval(charger, INTERVALLE_RAFRAICHISSEMENT_MS);
    return () => clearInterval(intervalle);
  }, [employeeFiltre]);

  useEffect(() => {
    const gestionnaire = (e) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target)) {
        setOuvert(false);
      }
    };
    document.addEventListener('mousedown', gestionnaire);
    return () => document.removeEventListener('mousedown', gestionnaire);
  }, []);

  return (
    <div className="notif-bell-conteneur" ref={conteneurRef}>
      <button type="button" className="notif-bell-bouton" onClick={() => setOuvert(!ouvert)} aria-label={t('notifications.titreAdmin')}>
        👥
      </button>
      {ouvert && (
        <div className="notif-bell-panneau">
          <h4>{t('notifications.titreAdmin')}</h4>
          <select
            className="notif-bell-filtre"
            value={employeeFiltre}
            onChange={(e) => setEmployeeFiltre(e.target.value)}
          >
            <option value="">{t('common.allEmployees')}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom}
              </option>
            ))}
          </select>
          <div className="notif-bell-liste">
            {notifications.map((n) => (
              <div key={n.id} className="notif-bell-item">
                <div className="notif-bell-corps">
                  <strong>
                    {n.prenom} {n.nom}
                  </strong>{' '}
                  — {n.corps}
                </div>
                <div className="notif-bell-date">{new Date(n.date_creation.replace(' ', 'T') + 'Z').toLocaleString(locale)}</div>
              </div>
            ))}
            {notifications.length === 0 && <p className="vide">{t('notifications.aucune')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
