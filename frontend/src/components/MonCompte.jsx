import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';

export default function MonCompte() {
  const { user, deconnecter } = useAuth();
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      await api.changerMotDePasse(motDePasseActuel, nouveauMotDePasse);
      setMessage('Mot de passe modifie.');
      setMotDePasseActuel('');
      setNouveauMotDePasse('');
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <div className="panel">
      <h2>Mon compte</h2>
      <p>
        Connecte en tant que <strong>{user.email}</strong> (
        {user.role === 'admin' ? 'Administrateur' : 'Employe'})
      </p>

      {erreur && <p className="erreur">{erreur}</p>}
      {message && <p className="confirmation">{message}</p>}

      <form className="form-inline" onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Mot de passe actuel"
          value={motDePasseActuel}
          onChange={(e) => setMotDePasseActuel(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={nouveauMotDePasse}
          onChange={(e) => setNouveauMotDePasse(e.target.value)}
          required
        />
        <button type="submit">Changer le mot de passe</button>
      </form>

      <button className="secondary" onClick={deconnecter}>
        Se deconnecter
      </button>
    </div>
  );
}
