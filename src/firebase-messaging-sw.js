// firebase-messaging-sw.js - CORREGIR

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

// ✅ Usar onBackgroundMessage (compatible con la versión 10.x)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Mensaje en background:', payload);
  
  // ✅ Obtener título y cuerpo del payload
  let title = payload.notification?.title || 'Lab.Demitrio';
  let body = payload.notification?.body || 'Tienes una notificación';
  
  // ✅ Si hay datos detallados, usarlos
  if (payload.data?.titulo_detallado) {
    title = payload.data.titulo_detallado;
  }
  if (payload.data?.cuerpo_detallado) {
    body = payload.data.cuerpo_detallado;
  }
  
  // ✅ Para Android, a veces el título viene en android.notification
  if (payload.android?.notification?.title) {
    title = payload.android.notification.title;
  }
  if (payload.android?.notification?.body) {
    body = payload.android.notification.body;
  }
  
  const notificationOptions = {
    body: body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: payload.data?.ordenId || `fcm-${Date.now()}`
  };

  self.registration.showNotification(title, notificationOptions);
});