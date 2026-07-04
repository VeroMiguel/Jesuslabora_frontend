// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyD52uK_xBXysS7bLkc65DLoHgKmhOayg7k',
  authDomain: 'jesuslabora.firebaseapp.com',
  projectId: 'jesuslabora',
  storageBucket: 'jesuslabora.firebasestorage.app',
  messagingSenderId: '986217821871',
  appId: '1:986217821871:web:9309f4cbfc03b33319c65a'
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ✅ IMPORTANTE: Usar setBackgroundMessageHandler en lugar de onBackgroundMessage
// para compatibilidad con versiones anteriores
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Mensaje en background:', payload);
  
  const notificationTitle = payload.notification?.title || 'Lab.Demitrio';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes una notificación',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});