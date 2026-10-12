importScripts('https://www.gstatic.com/firebasejs/9.20.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.20.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBP_A2y0eWPDEIZoX1RV0sl4E30j9WzIZ0",
  authDomain: "foodiee-c1d35.firebaseapp.com",
  projectId: "foodiee-c1d35",
  storageBucket: "foodiee-c1d35.firebasestorage.app",
  messagingSenderId: "375959156815",
  appId: "1:375959156815:web:e8f604c166a4e641a2923a",
  measurementId: "G-CWXX3TDZVY"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title || "Foodiee Notification";
  const notificationOptions = {
    body: payload.notification.body || "Check out latest updates!",
    icon: '/logo.png', // మీ యాప్ లోగో
    image: payload.notification.image || payload.data?.image, // 👈 ఇక్కడే ఆ పెద్ద ఇమేజ్ వస్తుంది
    data: {
      url: payload.data?.click_action || 'https://foodiee.shop'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});