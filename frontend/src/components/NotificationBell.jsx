import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useLangue } from '../LangueContext.jsx';

const INTERVALLE_RAFRAICHISSEMENT_MS = 60000;

export default function NotificationBell() {
  const { t, locale } = useLangue();
  const [notifications, setNotifications] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef(null);

  const charger = () => {
    api.getNotifications().then(setNotifications).catch(() => {});
  };

  useEffect(() => {
    charger();
    const intervalle = setInterval(charger, INTERVALLE_RAFRAICHISSEMENT_MS);
    return () => clearInterval(intervalle);
  }, []);

  // Ferme le panneau si on clique en dehors.
  useEffect(() => {
    const gestionnaire = (e) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target)) {
        setOuvert(false);
      }
    };
    document.addEventListener('mousedown', gestionnaire);
    return () => document.removeEventListener('mousedown', gestionnaire);
  }, []);

  const nbNonLues = notifications.filter((n) => !n.lu).length;

  // Recharge a chaque ouverture (pas seulement toutes les 60s): une
  // notification survenue juste avant l'ouverture doit apparaitre
  // immediatement, sans attendre le prochain rafraichissement periodique.
  const basculerPanneau = () => {
    const prochainEtat = !ouvert;
    setOuvert(prochainEtat);
    if (prochainEtat) {
      api.getNotifications().then((liste) => {
        setNotifications(liste);
        if (liste.some((n) => !n.lu)) {
          api.marquerNotificationsLues().then(() => {
            setNotifications((l) => l.map((n) => ({ ...n, lu: 1 })));
          });
        }
      }).catch(() => {});
    }
  };

  return (
    <div className="notif-bell-conteneur" ref={conteneurRef}>
      <button type="button" className="notif-bell-bouton" onClick={basculerPanneau} aria-label={t('notifications.titre')}>
        🔔
        {nbNonLues > 0 && <span className="notif-bell-badge">{nbNonLues > 99 ? '99+' : nbNonLues}</span>}
      </button>
      {ouvert && (
        <div className="notif-bell-panneau">
          <h4>{t('notifications.titre')}</h4>
          <div className="notif-bell-liste">
            {notifications.map((n) => (
              <div key={n.id} className={`notif-bell-item ${n.lu ? '' : 'notif-bell-item-non-lue'}`}>
                <div className="notif-bell-corps">{n.corps}</div>
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
