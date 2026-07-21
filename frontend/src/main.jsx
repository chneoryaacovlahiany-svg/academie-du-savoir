import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { DeviseProvider } from './DeviseContext.jsx';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DeviseProvider>
      <App />
    </DeviseProvider>
  </React.StrictMode>
);
