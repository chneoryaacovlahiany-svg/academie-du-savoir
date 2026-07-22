import { useEffect, useState } from 'react';
import { api } from '../api';

const CHAMPS_PARAMETRES = [
  { cle: 'heures_standard_jour', label: 'Heures standard par jour', step: '0.5' },
  { cle: 'seuil_heures_sup_125', label: 'Heures sup. a 125% avant de passer a 150%', step: '0.5' },
  { cle: 'majoration_heures_sup_125', label: 'Majoration heures sup. (1re tranche)', step: '0.01' },
  { cle: 'majoration_heures_sup_150', label: 'Majoration heures sup. (2e tranche)', step: '0.01' },
  { cle: 'accumulation_maladie_mois', label: 'Jours de maladie acquis par mois travaille', step: '0.1' },
  { cle: 'plafond_conges_maladie', label: 'Plafond de jours de maladie cumulables', step: '1' },
];

export default function Parametres() {
  const [parametres, setParametres] = useState(null);
  const [bareme, setBareme] = useState([]);
  const [feries, setFeries] = useState([]);
  const [nouvelleFerie, setNouvelleFerie] = useState({ date: '', nom: '' });
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    const [p, b, f] = await Promise.all([api.getParametres(), api.getBareme(), api.getFeries(annee)]);
    setParametres(p);
    setBareme(b);
    setFeries(f);
  };

  useEffect(() => {
    charger();
  }, [annee]);

  const handleParametreChange = (cle, valeur) => {
    setParametres({ ...parametres, [cle]: valeur });
  };

  const enregistrerParametres = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      await api.updateParametres(parametres);
      setMessage('Parametres enregistres.');
    } catch (err) {
      setErreur(err.message);
    }
  };

  const handleBaremeChange = (index, champ, valeur) => {
    const copie = [...bareme];
    copie[index] = { ...copie[index], [champ]: valeur };
    setBareme(copie);
  };

  const ajouterLigneBareme = () => {
    setBareme([...bareme, { anciennete_annees: '', jours_par_an: '' }]);
  };

  const supprimerLigneBareme = (index) => {
    setBareme(bareme.filter((_, i) => i !== index));
  };

  const enregistrerBareme = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      const lignes = bareme.map((l) => ({
        anciennete_annees: Number(l.anciennete_annees),
        jours_par_an: Number(l.jours_par_an),
      }));
      const resultat = await api.updateBareme(lignes);
      setBareme(resultat);
      setMessage('Bareme des conges enregistre.');
    } catch (err) {
      setErreur(err.message);
    }
  };

  const ajouterFerie = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      await api.createFerie(nouvelleFerie);
      setNouvelleFerie({ date: '', nom: '' });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const supprimerFerie = async (id) => {
    await api.deleteFerie(id);
    charger();
  };

  if (!parametres) return <div className="panel">Chargement...</div>;

  return (
    <div className="panel">
      <h2>Parametres</h2>

      <div className="avertissement-legal">
        Les valeurs par defaut ci-dessous sont donnees a titre indicatif et s'inspirent du droit du
        travail israelien (conges annuels, maladie, heures supplementaires). Elles ne remplacent pas
        un conseil professionnel: verifiez-les avec un comptable ou conseiller en paie (רואה חשבון /
        יועץ שכר) avant de vous en servir pour payer reellement vos employes.
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {message && <p className="confirmation">{message}</p>}

      <h3>Regles de calcul</h3>
      <form className="form-parametres" onSubmit={enregistrerParametres}>
        {CHAMPS_PARAMETRES.map((champ) => (
          <label key={champ.cle} className="champ-parametre">
            {champ.label}
            <input
              type="number"
              step={champ.step}
              min="0"
              value={parametres[champ.cle]}
              onChange={(e) => handleParametreChange(champ.cle, e.target.value)}
            />
          </label>
        ))}
        <button type="submit">Enregistrer les parametres</button>
      </form>

      <h3>Restriction IP pour le pointage "Bureau"</h3>
      <p className="aide">
        IP publique(s) du bureau, separees par des virgules (ex: 88.12.34.56). Un employe qui pointe
        en indiquant "Bureau" devra se connecter depuis l'une de ces IP; le pointage "Domicile" n'est
        jamais restreint. Laissez vide pour desactiver la verification.
      </p>
      <form className="form-inline" onSubmit={enregistrerParametres}>
        <input
          placeholder="Ex: 88.12.34.56"
          value={parametres.ip_bureau}
          onChange={(e) => handleParametreChange('ip_bureau', e.target.value)}
        />
        <button type="submit">Enregistrer les parametres</button>
      </form>

      <h3>Bareme des conges annuels par anciennete</h3>
      <p className="aide">
        A partir de combien d'annees d'anciennete l'employe acquiert-il ce nombre de jours par an ?
      </p>
      <form onSubmit={enregistrerBareme}>
        <table>
          <thead>
            <tr>
              <th>Anciennete (annees)</th>
              <th>Jours de conges / an</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bareme.map((ligne, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={ligne.anciennete_annees}
                    onChange={(e) => handleBaremeChange(index, 'anciennete_annees', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ligne.jours_par_an}
                    onChange={(e) => handleBaremeChange(index, 'jours_par_an', e.target.value)}
                  />
                </td>
                <td>
                  <button type="button" className="danger" onClick={() => supprimerLigneBareme(index)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions-bareme">
          <button type="button" className="secondary" onClick={ajouterLigneBareme}>
            Ajouter une ligne
          </button>
          <button type="submit">Enregistrer le bareme</button>
        </div>
      </form>

      <h3>Jours feries payes</h3>
      <div className="form-inline">
        <label>
          Annee:{' '}
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} />
        </label>
      </div>
      <form className="form-inline" onSubmit={ajouterFerie}>
        <input
          type="date"
          value={nouvelleFerie.date}
          onChange={(e) => setNouvelleFerie({ ...nouvelleFerie, date: e.target.value })}
          required
        />
        <input
          placeholder="Nom du jour ferie"
          value={nouvelleFerie.nom}
          onChange={(e) => setNouvelleFerie({ ...nouvelleFerie, nom: e.target.value })}
          required
        />
        <button type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Nom</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {feries.map((f) => (
            <tr key={f.id}>
              <td>{f.date}</td>
              <td>{f.nom}</td>
              <td className="actions">
                <button className="danger" onClick={() => supprimerFerie(f.id)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {feries.length === 0 && (
            <tr>
              <td colSpan={3} className="vide">
                Aucun jour ferie enregistre pour {annee}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
