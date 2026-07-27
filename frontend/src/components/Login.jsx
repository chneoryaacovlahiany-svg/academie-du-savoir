import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { useLangue, LANGUES } from '../LangueContext.jsx';

export default function Login() {
  const { connecter } = useAuth();
  const { t, langue, changerLangue } = useLangue();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      await connecter(email, password);
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <div className="app app-login">
      <div className="panel panel-login">
        <label className="selecteur-devise selecteur-langue-login">
          <select value={langue} onChange={(e) => changerLangue(e.target.value)}>
            {LANGUES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <h2>{t('login.title')}</h2>
        <p className="subtitle">{t('login.subtitle')}</p>
        {erreur && <p className="erreur">{erreur}</p>}
        <form className="form-connexion" onSubmit={handleSubmit}>
          <label>
            {t('login.identifiant')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label>
            {t('login.motDePasse')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit">{t('login.seConnecter')}</button>
        </form>
      </div>
    </div>
  );
}
