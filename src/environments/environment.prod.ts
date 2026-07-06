// src/environments/environment.prod.ts
export const environment = {
  production: true,
  enableFirebase: true,  // ✅ IMPORTANTE: Debe ser true
  apiUrl: 'https://jesuslaboraback-production.up.railway.app/api',
  baseUrl: 'https://jesuslaboraback-production.up.railway.app',
  wsUrl: 'wss://jesuslaboraback-production.up.railway.app',
  firebase: {
    apiKey: 'AIzaSyD52uK_xBXysS7bLkc65DLoHgKmhOayg7k',
    authDomain: 'jesuslabora.firebaseapp.com',
    projectId: 'jesuslabora',
    storageBucket: 'jesuslabora.firebasestorage.app',
    messagingSenderId: '986217821871',
    appId: '1:986217821871:web:9309f4cbfc03b33319c65a',
    vapidKey: 'BD2ufJ5j_SU-vWSr27kqUECxLP35NjHZg8ZmiZnhMnqi9E4e9LeBcd6n-EazNHBEcfE-jBvqxRz3sveYl9nRVRI'
  }
};