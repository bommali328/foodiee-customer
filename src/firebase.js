import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBP_A2y0eWPDEIZoX1RV0sl4E30j9WzIZ0",
  authDomain: "foodiee-c1d35.firebaseapp.com",
  projectId: "foodiee-c1d35",
  storageBucket: "foodiee-c1d35.firebasestorage.app",
  messagingSenderId: "375959156815",
  appId: "1:375959156815:web:e8f604c166a4e641a2923a",
  measurementId: "G-CWXX3TDZVY"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 👇 1. టోకెన్‌ను బ్యాక్‌ఎండ్‌కు పంపే ఫంక్షన్ ఇక్కడ రాయండి
const sendTokenToBackend = async (mobile, token) => {
  try {
    await fetch('http://localhost:8080/api/customers/update-fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobile, fcmToken: token })
    });
    console.log("FCM Token successfully sent to backend!");
  } catch (error) {
    console.error("Error sending token to backend:", error);
  }
};

// 👇 2. పర్మిషన్ అడిగి టోకెన్ తీసుకునే ఫంక్షన్
export const requestCustomerNotificationPermission = async (customerMobile) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { 
        vapidKey: 'BF-5htY4zliIE653UyTdHQ9Em8CbprK761jZb9_U60d1_dqh0FY25rOOEuG6Vy69jQdVI7kWVxMZPr4TipHzhhg' 
      });
      console.log('Customer FCM Token:', token);

      // కస్టమర్ మొబైల్ నంబర్ ఉంటే, ఆ టోకెన్‌ను బ్యాక్‌ఎండ్‌కు పంపుతాం
      if (customerMobile && token) {
        await sendTokenToBackend(customerMobile, token);
      }
      
      return token;
    } else {
      console.log('Notification permission denied.');
    }
  } catch (error) {
    console.error('Error getting notification token:', error);
  }
};

export const onForegroundMessageListener = () => {
  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
  });
};