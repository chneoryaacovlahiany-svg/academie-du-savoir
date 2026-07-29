import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useLangue } from '../LangueContext.jsx';

// Historique des avertissements: pour un admin, tous les employes (avec leur
// nom); pour un employe, uniquement les siens (le backend restreint deja la
// reponse a req.user.employee_id cote serveur, meme si un admin appelait
// cette route avec un autre id). Le paramétrage (seuil, activation, modeles
// de message par palier) et l'envoi manuel restent dans Parametres.
export default function Avertissements() {
  const { user } = useAuth();
  const { t, locale } = useLangue();
  const [avertissements, setAvertissements] = useState([]);

  useEffect(() => {
    api.getAvertissements().then(setAvertissements);
  }, []);

  const estAdmin = user.role === 'admin';

  return (
    <div className="panel">
      <h2>{t('tabs.avertissements')}</h2>
      <p className="aide">
        {estAdmin ? t('parametres.avertissementsHistoriqueTitre') : t('monCompte.avertissementsAide')}
      </p>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t('parametres.colDateEnvoi')}</th>
            {estAdmin && <th>{t('parametres.colEmploye')}</th>}
            <th>{t('parametres.colNiveau')}</th>
            <th>{t('parametres.colMessage')}</th>
          </tr>
        </thead>
        <tbody>
          {avertissements.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.date_envoi.replace(' ', 'T') + 'Z').toLocaleString(locale)}</td>
              {estAdmin && (
                <td>
                  {a.prenom} {a.nom}
                </td>
              )}
              <td>{a.niveau}</td>
              <td>{a.message}</td>
            </tr>
          ))}
          {avertissements.length === 0 && (
            <tr>
              <td colSpan={estAdmin ? 4 : 3} className="vide">
                {t('parametres.aucunAvertissement')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
