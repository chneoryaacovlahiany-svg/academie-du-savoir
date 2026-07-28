import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useLangue } from '../LangueContext.jsx';

export default function MonCompte() {
  const { user, deconnecter } = useAuth();
  const { t, locale } = useLangue();
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [avertissements, setAvertissements] = useState([]);

  useEffect(() => {
    if (user.employee_id) {
      api.getAvertissements().then(setAvertissements);
    }
  }, [user.employee_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      await api.changerMotDePasse(motDePasseActuel, nouveauMotDePasse);
      setMessage(t('monCompte.motDePasseModifie'));
      setMotDePasseActuel('');
      setNouveauMotDePasse('');
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <div className="panel">
      <h2>{t('monCompte.title')}</h2>
      <p>
        {t('monCompte.connecteEnTant')} <strong>{user.email}</strong> (
        {user.role === 'admin' ? t('comptes.roleAdmin') : t('comptes.roleEmploye')})
      </p>

      {erreur && <p className="erreur">{erreur}</p>}
      {message && <p className="confirmation">{message}</p>}

      <form className="form-inline" onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder={t('monCompte.motDePasseActuelPlaceholder')}
          value={motDePasseActuel}
          onChange={(e) => setMotDePasseActuel(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t('monCompte.nouveauMotDePassePlaceholder')}
          value={nouveauMotDePasse}
          onChange={(e) => setNouveauMotDePasse(e.target.value)}
          required
        />
        <button type="submit">{t('monCompte.changerMotDePasse')}</button>
      </form>

      <button className="secondary" onClick={deconnecter}>
        {t('monCompte.seDeconnecter')}
      </button>

      {user.employee_id && (
        <>
          <h3>{t('monCompte.avertissementsTitre')}</h3>
          <p className="aide">{t('monCompte.avertissementsAide')}</p>
          <table>
            <thead>
              <tr>
                <th>{t('parametres.colDateEnvoi')}</th>
                <th>{t('parametres.colNiveau')}</th>
                <th>{t('parametres.colMessage')}</th>
              </tr>
            </thead>
            <tbody>
              {avertissements.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.date_envoi.replace(' ', 'T') + 'Z').toLocaleString(locale)}</td>
                  <td>{a.niveau}</td>
                  <td>{a.message}</td>
                </tr>
              ))}
              {avertissements.length === 0 && (
                <tr>
                  <td colSpan={3} className="vide">
                    {t('parametres.aucunAvertissement')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
