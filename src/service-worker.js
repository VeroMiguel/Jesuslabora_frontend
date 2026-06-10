/**
 * service-worker.js — Lab.Rosas
 * Service Worker ÚNICO (fusiona caché + Firebase)
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_NAME = 'jesuslabora-v3';
const APP_SHELL = ['/'];

// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================
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

// ✅ Variable para evitar notificaciones duplicadas
let ultimaNotificacion = null;

// ============================================
// MANEJADOR DE NOTIFICACIONES EN BACKGROUND (FCM)
// ============================================
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje en background recibido:', payload);
  
  // ✅ Prevenir duplicados (misma notificación en menos de 2 segundos)
  const ahora = Date.now();
  const notificacionId = payload.data?.ordenId || payload.notification?.title;
  
  if (ultimaNotificacion === notificacionId && (ahora - (payload.timestamp || 0) < 2000)) {
    console.log('[SW] Notificación duplicada ignorada');
    return;
  }
  ultimaNotificacion = notificacionId;
  
  let titulo = payload.notification?.title || '📋 Lab.jesuslabora';
  let cuerpo = payload.notification?.body || 'Tienes una notificación pendiente';
  let urlDestino = payload.data?.url || '/ordenes';
  
  // ✅ Usar datos detallados de android.notification si existen
  if (payload.data?.titulo_detallado) {
    titulo = payload.data.titulo_detallado;
  }
  if (payload.data?.cuerpo_detallado) {
    cuerpo = payload.data.cuerpo_detallado;
  }
  
  const opciones = {
    body: cuerpo,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.ordenId || `fcm-${Date.now()}`,
    data: { 
      url: urlDestino, 
      ...payload.data,
      timestamp: ahora 
    },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [] // SIN BOTONES
  };
  
  self.registration.showNotification(titulo, opciones);
});

// ============================================
// CLICK EN NOTIFICACIÓN
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación');
  event.notification.close();
  
  let urlDestino = '/ordenes';
  if (event.notification.data && event.notification.data.url) {
    urlDestino = event.notification.data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (client.url !== urlDestino && 'navigate' in client) {
              client.navigate(urlDestino);
            }
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlDestino);
        }
      })
  );
});

// ============================================
// CACHÉ PARA OFFLINE
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('[SW] Error cacheando:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activado');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Eliminando caché antiguo:', key);
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // No cachear API ni Firebase
  if (url.pathname.startsWith('/api')) return;
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) return;
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && (
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.ico') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.woff2')
        )) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

console.log('[SW] ✅ Service Worker unificado listo');