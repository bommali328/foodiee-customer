import React from 'react';
import ReactDOM from 'react-dom/client';
import CustomerApp from './CustomerApp.jsx';
import ErrorBoundary from './ErrorBoundary.jsx'; // 👈 దీన్ని ఇంపోర్ట్ చేయండి
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <CustomerApp />
    </ErrorBoundary>
  </React.StrictMode>,
);