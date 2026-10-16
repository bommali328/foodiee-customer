import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

// టోకెన్‌ను బ్యాక్‌ఎండ్‌కు పంపే ఫంక్షన్
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

// నోటిఫికేషన్ పర్మిషన్ మరియు నేటివ్ టోకెన్ తెచ్చుకోవడం
export const requestCustomerNotificationPermission = async (customerMobile) => {
  try {
    // ఒకవేళ ఆండ్రాయిడ్ యాప్ (Capacitor) అయితే నేటివ్ పుష్ నోటిఫికేషన్స్ వాడాలి
    if (Capacitor.isNativePlatform()) {
      let permResult = await PushNotifications.checkPermissions();
      if (permResult.receive === 'prompt') {
        permResult = await PushNotifications.requestPermissions();
      }
      
      if (permResult.receive === 'granted') {
        await PushNotifications.register();
        
        // నేటివ్ టోకెన్ రిజిస్ట్రేషన్ లిసనర్
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
      console.log('Running on non-native platform. Skipping native push registration.');
    }
  } catch (error) {
    console.error('Error getting notification token:', error);
  }
};

// ఫోర్‌గ్రౌండ్ లిసనర్
export const onForegroundMessageListener = () => {
  // నేటివ్ ప్లాట్‌ఫారమ్‌లో పుష్ నోటిఫికేషన్స్ పైనున్న లిసనర్ ద్వారా హ్యాండ్ చేయబడతాయి
};