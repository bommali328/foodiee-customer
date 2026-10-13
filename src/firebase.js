import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: "AIzaSyBP_A2y0eWPDEIZoX1RV0sl4E30j9WzIZ0",
  authDomain: "foodiee-c1d35.firebaseapp.com",
  projectId: "foodiee-c1d35",
  storageBucket: "foodiee-c1d35.firebasestorage.app",
  messagingSenderId: "375959156815",
  appId: "1:375959156815:web:e8f604c166a4e641a2923a",
  measurementId: "G-CWXX3TDZVY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// టోకెన్‌ను బ్యాక్‌ఎండ్‌కు పంపే ఫంక్షన్ (ప్రొడక్షన్ URL వాడటం మంచిది)
const sendTokenToBackend = async (mobile, token) => {
  try {
    await fetch('https://api.foodiee.shop/api/customers/update-fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobile, fcmToken: token })
    });
    console.log("FCM Token successfully sent to backend!");
  } catch (error) {
    console.error("Error sending token to backend:", error);
  }
};

// నోటిఫికేషన్ పర్మిషన్ మరియు టోకెన్ తెచ్చుకోవడం
export const requestCustomerNotificationPermission = async (customerMobile) => {
  try {
    // ఒకవేళ ఆండ్రాయిడ్ యాప్ (Capacitor) అయితే నేటివ్ పుష్ నోటిఫికేషన్స్ వాడాలి
    if (Capacitor.isNativePlatform()) {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive === 'granted') {
        await PushNotifications.register();
        
        // నేటివ్ టోకెన్ రిజిస్ట్రేషన్ లిెసనర్
        PushNotifications.addListener('registration', async (token) => {
          console.log('Native Push Registration Token:', token.value);
          if (customerMobile && token.value) {
            await sendTokenToBackend(customerMobile, token.value);
          }
        });

        // నోటిఫికేషన్ రిసీవ్ అయినప్పుడు (లాక్ స్క్రీన్/హోమ్ స్క్రీన్ కోసం)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ', notification);
        });
      }
    } else {
      // వెబ్ బ్రౌజర్ కోసం ఫైర్‌బేస్ మెసేజింగ్
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { 
          vapidKey: 'BF-5htY4zliIE653UyTdHQ9Em8CbprK761jZb9_U60d1_dqh0FY25rOOEuG6Vy69jQdVI7kWVxMZPr4TipHzhhg' 
        });
        console.log('Web FCM Token:', token);

        if (customerMobile && token) {
          await sendTokenToBackend(customerMobile, token);
        }
        return token;
      } else {
        console.log('Notification permission denied.');
      }
    }
  } catch (error) {
    console.error('Error getting notification token:', error);
  }
};

// ఫోర్‌గ్రౌండ్ లో ఎలాంటి ఇన్-యాప్ పాప్-అప్స్ రాకుండా కేవలం కన్సోల్ లాగ్ ఉంచడం
export const onForegroundMessageListener = () => {
  if (!Capacitor.isNativePlatform()) {
    return onMessage(messaging, (payload) => {
      console.log('Foreground message received (No in-app toast):', payload);
    });
  }
};