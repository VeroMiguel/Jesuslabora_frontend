// environment.ts
export const environment = {
  production: false,
  baseUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000',
  apiUrl: 'http://localhost:3000/api',
  // ✅ Deshabilitar Firebase en desarrollo
  enableFirebase: false,
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    vapidKey: ''
  }
};