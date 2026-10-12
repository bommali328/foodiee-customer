import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import CustomerApp from './CustomerApp.jsx';
import ErrorBoundary from './ErrorBoundary.jsx'; // 👈 దీన్ని ఇంపోర్ట్ చేయండి
import './index.css';
import { requestCustomerNotificationPermission, onForegroundMessageListener } from './firebase';

function MainWrapper() {
  useEffect(() => {
    // 1. App load avvagane notification permission adigi FCM token thechukovadam
    requestCustomerNotificationPermission();

    // 2. App open lo unnapudu (foreground) messages ni receive chesukovadam
    const unsubscribe = onForegroundMessageListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <CustomerApp />
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MainWrapper />
  </React.StrictMode>,
);