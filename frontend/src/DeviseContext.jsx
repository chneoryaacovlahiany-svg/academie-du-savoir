import { createContext, useContext, useState } from 'react';

export const DEVISES = [
  { code: 'EUR', symbole: '€' },
  { code: 'USD', symbole: '$' },
  { code: 'ILS', symbole: '₪' },
];

const CLE_STOCKAGE = 'pointeuse_devise';

const DeviseContext = createContext(null);

export function DeviseProvider({ children }) {
  const [code, setCode] = useState(() => localStorage.getItem(CLE_STOCKAGE) || 'EUR');

  const changerDevise = (nouveauCode) => {
    localStorage.setItem(CLE_STOCKAGE, nouveauCode);
    setCode(nouveauCode);
  };

  const devise = DEVISES.find((d) => d.code === code) || DEVISES[0];
  const formatMontant = (valeur) => `${Number(valeur ?? 0).toFixed(2)} ${devise.symbole}`;

  return (
    <DeviseContext.Provider value={{ devise, changerDevise, formatMontant }}>
      {children}
    </DeviseContext.Provider>
  );
}

export function useDevise() {
  return useContext(DeviseContext);
}
