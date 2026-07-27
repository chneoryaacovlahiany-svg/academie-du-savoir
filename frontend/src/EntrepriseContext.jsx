import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const EntrepriseContext = createContext(null);

const VIDE = { nom: '', adresse: '', telephone: '', email: '', logo: '' };

export function EntrepriseProvider({ children }) {
  const [entreprise, setEntreprise] = useState(VIDE);

  const rafraichirEntreprise = async () => {
    try {
      const infos = await api.getEntreprise();
      setEntreprise(infos);
    } catch {
      setEntreprise(VIDE);
    }
  };

  useEffect(() => {
    rafraichirEntreprise();
  }, []);

  return (
    <EntrepriseContext.Provider value={{ entreprise, rafraichirEntreprise }}>
      {children}
    </EntrepriseContext.Provider>
  );
}

export function useEntreprise() {
  return useContext(EntrepriseContext);
}
