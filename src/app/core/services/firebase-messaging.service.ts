/**
 * FirebaseMessagingService
 * ─────────────────────────────────────────────────────────────────────────────
 * Encapsula toda la lógica de Firebase Cloud Messaging (FCM):
 *   • Inicialización de la app Firebase (singleton)
 *   • Registro del Service Worker de Firebase
 *   • Solicitud de permiso y obtención del token FCM del dispositivo
 *   • Escucha de mensajes en foreground
 *   • Persistencia del token en localStorage
 *
 * IMPORTANTE: Para que FCM funcione debes reemplazar los valores PLACEHOLDER
 * en src/environments/environment.ts y environment.prod.ts con los datos
 * reales de tu proyecto Firebase (Consola → Configuración del proyecto).
 * También necesitas la VAPID key (Consola → Cloud Messaging → Web Push).
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Tipos internos ──────────────────────────────────────────────────────────

export interface FcmMessage {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, string>;
}

export type FcmStatus =
  | 'not-initialized'
  | 'initializing'
  | 'ready'
  | 'no-permission'
  | 'unsupported'
  | 'error';

// ─── Constantes ──────────────────────────────────────────────────────────────

const FCM_TOKEN_KEY = 'fcm_device_token';
const FCM_TOKEN_DATE_KEY = 'fcm_token_date';
/** Renovar token cada 7 días */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService implements OnDestroy {

  // ─── Estado público ───────────────────────────────────────────────────────

  private statusSubject = new BehaviorSubject<FcmStatus>('not-initialized');
  public status$: Observable<FcmStatus> = this.statusSubject.asObservable();

  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$: Observable<string | null> = this.tokenSubject.asObservable();

  private messageSubject = new BehaviorSubject<FcmMessage | null>(null);
  public message$: Observable<FcmMessage | null> = this.messageSubject.asObservable();

  // ─── Internos ─────────────────────────────────────────────────────────────

  private firebaseApp: any = null;
  private messaging: any = null;
  private unsubscribeOnMessage: (() => void) | null = null;

  // ─── Inicialización ───────────────────────────────────────────────────────

  /**
   * Inicializa Firebase y FCM. Llama a este método una sola vez desde AppComponent.
   * Es seguro llamarlo múltiples veces (idempotente).
   */
  async initialize(): Promise<void> {
    // ✅ No inicializar FCM en desarrollo local
    if (!environment.production) {
        console.log('[FCM] Firebase Messaging deshabilitado en modo desarrollo');
        this.statusSubject.next('unsupported');
        return;
    }
    
    if (this.statusSubject.value !== 'not-initialized') return;

    // Verificar soporte del navegador
    if (!this.isSupported()) {
      console.warn('[FCM] Navegador no soporta notificaciones push');
      this.statusSubject.next('unsupported');
      return;
    }

    // Verificar que la config no sea placeholder
    if (this.isPlaceholderConfig()) {
      console.warn(
        '[FCM] ⚠️ Configuración Firebase con valores PLACEHOLDER.\n' +
        'Reemplaza los valores en src/environments/environment.ts con los datos\n' +
        'reales de tu proyecto Firebase para activar las notificaciones push.'
      );
      this.statusSubject.next('error');
      return;
    }

    this.statusSubject.next('initializing');

    try {
      // Importación dinámica para no bloquear el bundle principal
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

      // Singleton: reusar app si ya fue inicializada
      this.firebaseApp = getApps().length === 0
        ? initializeApp(environment.firebase)
        : getApp();

      this.messaging = getMessaging(this.firebaseApp);

      // Escuchar mensajes en foreground
      this.unsubscribeOnMessage = onMessage(this.messaging, (payload: any) => {
        console.log('[FCM] Mensaje en foreground recibido:', payload);
        const msg: FcmMessage = {
          title: payload.notification?.title ?? 'Lab.Demitrio',
          body: payload.notification?.body ?? '',
          icon: payload.notification?.icon ?? '/favicon.ico',
          tag: payload.data?.tag,
          data: payload.data
        };
        this.messageSubject.next(msg);
      });

      this.statusSubject.next('ready');
      console.log('[FCM] ✅ Firebase Messaging inicializado');

      // Intentar obtener token si ya hay permiso
      if (Notification.permission === 'granted') {
        await this.obtenerToken();
      }

    } catch (error) {
      console.error('[FCM] Error inicializando Firebase:', error);
      this.statusSubject.next('error');
    }
  }

  // ─── Permisos y token ─────────────────────────────────────────────────────

  /**
   * Solicita permiso de notificaciones y obtiene el token FCM del dispositivo.
   * Retorna el token o null si no se pudo obtener.
   */
  async solicitarPermisoYObtenerToken(forceRefresh: boolean = false): Promise<string | null> {
    if (!this.isSupported()) return null;

    if (this.statusSubject.value === 'not-initialized') {
        await this.initialize();
    }

    if (this.statusSubject.value !== 'ready') {
        console.warn('[FCM] No está listo para obtener token. Estado:', this.statusSubject.value);
        return null;
    }

    let permiso = Notification.permission;
    if (permiso === 'default') {
        permiso = await Notification.requestPermission();
    }

    if (permiso !== 'granted') {
        console.warn('[FCM] Permiso de notificaciones denegado');
        this.statusSubject.next('no-permission');
        return null;
    }

    return this.obtenerToken(forceRefresh);
  }

  /**
   * Obtiene el token FCM. Usa caché si es reciente (< 7 días).
   * @param forceRefresh Si es true, ignora la caché y obtiene un token nuevo
   */
// firebase-messaging.service.ts - VERSIÓN CORREGIDA

async obtenerToken(forceRefresh: boolean = false): Promise<string | null> {
    if (!this.messaging) {
        console.warn('[FCM] Messaging no inicializado');
        return null;
    }

    // Si forceRefresh, eliminar caché
    if (forceRefresh) {
        console.log('🔄 Forzando renovación de token...');
        localStorage.removeItem(FCM_TOKEN_KEY);
        localStorage.removeItem(FCM_TOKEN_DATE_KEY);
        this.tokenSubject.next(null);
        
        // ✅ Limpiar TODOS los Service Workers
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                    console.log('🗑️ Service Worker desregistrado:', registration.scope);
                }
                // ✅ Esperar a que los SW se desregistren
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err) {
                console.warn('Error desregistrando SW:', err);
            }
        }
    } else {
        const tokenCacheado = this.getTokenFromCache();
        if (tokenCacheado) {
            this.tokenSubject.next(tokenCacheado);
            return tokenCacheado;
        }
    }

    try {
        const { getToken } = await import('firebase/messaging');

        // ✅ Registrar el SW de Firebase CORRECTAMENTE
        let swRegistration: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
            try {
                // ✅ Primero intentar con firebase-messaging-sw.js
                swRegistration = await navigator.serviceWorker.register(
                    '/firebase-messaging-sw.js',
                    { 
                        scope: '/firebase-cloud-messaging-push-scope', 
                        updateViaCache: 'none' 
                    }
                );
                console.log('[FCM] ✅ SW de Firebase registrado en:', swRegistration.scope);
                
                // ✅ Esperar a que el SW esté activo
                if (swRegistration.waiting) {
                    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
                
                // ✅ Esperar a que el SW esté listo
                await navigator.serviceWorker.ready;
                console.log('[FCM] ✅ SW listo');
            } catch (swErr) {
                console.warn('[FCM] Error registrando firebase-messaging-sw.js:', swErr);
                // ✅ Fallback a service-worker.js
                try {
                    swRegistration = await navigator.serviceWorker.register(
                        '/service-worker.js',
                        { 
                            scope: '/', 
                            updateViaCache: 'none' 
                        }
                    );
                    console.log('[FCM] ✅ SW registrado con service-worker.js');
                } catch (err2) {
                    console.error('[FCM] Error registrando SW con fallback:', err2);
                }
            }
        }

        // ✅ Obtener token con el SW registrado
        const token = await getToken(this.messaging, {
            vapidKey: environment.firebase.vapidKey,
            serviceWorkerRegistration: swRegistration
        });

        if (token && token.length > 20) {
            this.saveTokenToCache(token);
            this.tokenSubject.next(token);
            console.log(`[FCM] ✅ Token obtenido:`, token.substring(0, 30) + '...');
            return token;
        } else {
            console.warn('[FCM] Token inválido o vacío:', token);
            return null;
        }
    } catch (error) {
        console.error('[FCM] Error obteniendo token:', error);
        return null;
    }
}

  // ─── Getters de estado ────────────────────────────────────────────────────

  get estaListo(): boolean {
    return this.statusSubject.value === 'ready';
  }

  get tokenActual(): string | null {
    return this.tokenSubject.value;
  }

  get estadoActual(): FcmStatus {
    return this.statusSubject.value;
  }

  get esCompatible(): boolean {
    return this.isSupported();
  }

  get tieneConfigReal(): boolean {
    return !this.isPlaceholderConfig();
  }

  // ─── Caché de token ───────────────────────────────────────────────────────

  private getTokenFromCache(): string | null {
    try {
      const token = localStorage.getItem(FCM_TOKEN_KEY);
      const dateStr = localStorage.getItem(FCM_TOKEN_DATE_KEY);
      if (!token || !dateStr) return null;

      const tokenDate = new Date(dateStr).getTime();
      if (Date.now() - tokenDate > TOKEN_TTL_MS) {
        localStorage.removeItem(FCM_TOKEN_KEY);
        localStorage.removeItem(FCM_TOKEN_DATE_KEY);
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  private saveTokenToCache(token: string): void {
    try {
      localStorage.setItem(FCM_TOKEN_KEY, token);
      localStorage.setItem(FCM_TOKEN_DATE_KEY, new Date().toISOString());
    } catch {
      // localStorage puede estar lleno
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private isSupported(): boolean {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  private isPlaceholderConfig(): boolean {
    const cfg = environment.firebase;
    return (
      !cfg ||
      !cfg.apiKey ||
      cfg.apiKey.includes('PLACEHOLDER') ||
      cfg.apiKey === 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345' ||
      !cfg.projectId ||
      cfg.projectId.includes('PLACEHOLDER') ||
      !cfg.vapidKey ||
      cfg.vapidKey.includes('PLACEHOLDER')
    );
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    if (this.unsubscribeOnMessage) {
      this.unsubscribeOnMessage();
    }
  }
}