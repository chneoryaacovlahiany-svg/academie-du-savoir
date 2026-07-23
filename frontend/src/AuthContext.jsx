import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [chargement, setChargement] = useState(true);

  const rafraichir = async () => {
    try {
      const u = await api.getMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    rafraichir();
  }, []);

  const connecter = async (email, password) => {
    const u = await api.login(email, password);
    setUser(u);
    return u;
  };

  const deconnecter = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, chargement, connecter, deconnecter, rafraichir }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
