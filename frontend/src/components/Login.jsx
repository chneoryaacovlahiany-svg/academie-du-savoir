import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const { connecter } = useAuth();
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
        <h2>Connexion</h2>
        <p className="subtitle">Pointeuse - acces reserve</p>
        {erreur && <p className="erreur">{erreur}</p>}
        <form className="form-connexion" onSubmit={handleSubmit}>
          <label>
            Identifiant
            <input value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit">Se connecter</button>
        </form>
      </div>
    </div>
  );
}
