import React, { useEffect } from 'react';
import CustomerApp from './CustomerApp.jsx';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export default function App() {
  useEffect(() => {
    // 1. పర్మిషన్స్ చెక్ చేసి రిక్వెస్ట్ చేయడం
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    });

   
    // 2. టోకెన్ సక్సెస్ ఫుల్ గా జనరేట్ అయినప్పుడు బ్యాక్‌ఎండ్‌కి పంపడం
    PushNotifications.addListener('registration', async (token) => {
      console.log('Native Push Registration Token:', token.value);
      
      try {
        const userMobile = localStorage.getItem('userMobile');
        
        if (userMobile) {
          const response = await fetch('https://api.foodiee.shop/api/customers/update-fcm-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mobile: userMobile,
              fcmToken: token.value
            })
          });
          
          if (response.ok) {
            console.log('FCM Token successfully synced to database!');
          } else {
            console.warn('FCM Token sync failed with status:', response.status);
          }
        } else {
          console.log('User mobile not found in localStorage yet, skipping token sync.');
        }
      } catch (error) {
        console.error('Failed to sync FCM token:', error);
      }
    });

    // 3. యాప్ రన్నింగ్‌లో ఉన్నప్పుడు (Foreground) నోటిఫికేషన్ వస్తే
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('Push notification received: ', notification);
      
      // మొబైల్ స్క్రీన్ పై లోకల్ నోటిఫికేషన్ లాగా చూపించడానికి
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || 'Foodiee',
            body: notification.body || 'New update regarding your order!',
            id: new Date().getTime(),
            sound: undefined,
            extra: notification.data
          }
        ]
      });
    });

    // 4. యూజర్ నోటిఫికేషన్ పై క్లిక్ చేసినప్పుడు
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed', notification.actionId, notification.notification);
    });
  }, []);

  return <CustomerApp />;
}