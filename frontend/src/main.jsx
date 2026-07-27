import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { DeviseProvider } from './DeviseContext.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { LangueProvider } from './LangueContext.jsx';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangueProvider>
      <AuthProvider>
        <DeviseProvider>
          <App />
        </DeviseProvider>
      </AuthProvider>
    </LangueProvider>
  </React.StrictMode>
);

// Necessaire pour que le navigateur propose "Installer l'application" sur
// telephone (icone + plein ecran) - sans effet si non supporte (ex: http local).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
