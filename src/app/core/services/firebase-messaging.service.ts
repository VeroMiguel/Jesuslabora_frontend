// src/app/core/services/firebase-messaging.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

const FCM_TOKEN_KEY = 'fcm_device_token';
const FCM_TOKEN_DATE_KEY = 'fcm_token_date';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService implements OnDestroy {

  private statusSubject = new BehaviorSubject<FcmStatus>('not-initialized');
  public status$: Observable<FcmStatus> = this.statusSubject.asObservable();

  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$: Observable<string | null> = this.tokenSubject.asObservable();

  private messageSubject = new BehaviorSubject<FcmMessage | null>(null);
  public message$: Observable<FcmMessage | null> = this.messageSubject.asObservable();

  private firebaseApp: any = null;
  private messaging: any = null;
  private unsubscribeOnMessage: (() => void) | null = null;
  private isInitializing = false;

  // ─── Inicialización ───────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // ✅ No inicializar FCM en desarrollo local
    if (!environment.production) {
      console.log('[FCM] Firebase Messaging deshabilitado en modo desarrollo');
      this.statusSubject.next('unsupported');
      return;
    }

    if (this.statusSubject.value !== 'not-initialized' || this.isInitializing) {
      return;
    }

    if (!this.isSupported()) {
      console.warn('[FCM] Navegador no soporta notificaciones push');
      this.statusSubject.next('unsupported');
      return;
    }

    if (this.isPlaceholderConfig()) {
      console.warn('[FCM] ⚠️ Configuración Firebase con valores PLACEHOLDER');
      this.statusSubject.next('error');
      return;
    }

    this.isInitializing = true;
    this.statusSubject.next('initializing');

    try {
      // ✅ Importar Firebase
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

      // ✅ Verificar si ya existe una app
      this.firebaseApp = getApps().length === 0
        ? initializeApp(environment.firebase)
        : getApp();

      this.messaging = getMessaging(this.firebaseApp);
      console.log('[FCM] ✅ Firebase inicializado correctamente');

      // ✅ Escuchar mensajes en foreground
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
      console.log('[FCM] ✅ Firebase Messaging listo');

      // ✅ Si ya tiene permiso, obtener token
      if (Notification.permission === 'granted') {
        await this.obtenerToken(false);
      }

    } catch (error) {
      console.error('[FCM] Error inicializando Firebase:', error);
      this.statusSubject.next('error');
    } finally {
      this.isInitializing = false;
    }
  }

  // ─── Obtener Token ───────────────────────────────────────────────────────

  async obtenerToken(forceRefresh: boolean = false): Promise<string | null> {
    // ✅ Si no está listo, intentar inicializar
    if (this.statusSubject.value === 'not-initialized') {
      await this.initialize();
    }

    if (this.statusSubject.value !== 'ready') {
      console.warn('[FCM] No está listo. Estado:', this.statusSubject.value);
      return null;
    }

    if (!this.messaging) {
      console.warn('[FCM] Messaging no disponible');
      return null;
    }

    // ✅ Si forceRefresh, limpiar caché
    if (forceRefresh) {
      console.log('🔄 Forzando renovación de token...');
      localStorage.removeItem(FCM_TOKEN_KEY);
      localStorage.removeItem(FCM_TOKEN_DATE_KEY);
      this.tokenSubject.next(null);
    }

    // ✅ Verificar caché
    const tokenCacheado = this.getTokenFromCache();
    if (tokenCacheado && !forceRefresh) {
      console.log('[FCM] ✅ Token recuperado de caché');
      this.tokenSubject.next(tokenCacheado);
      return tokenCacheado;
    }

    try {
      const { getToken } = await import('firebase/messaging');

      // ✅ Registrar el Service Worker
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          // ✅ Primero, asegurar que el SW esté registrado
          const registrations = await navigator.serviceWorker.getRegistrations();
          let swRegistered = false;
          
          for (const reg of registrations) {
            if (reg.active && reg.active.scriptURL.includes('service-worker.js')) {
              swRegistration = reg;
              swRegistered = true;
              console.log('[FCM] ✅ SW ya registrado:', reg.scope);
              break;
            }
          }

          if (!swRegistered) {
            console.log('[FCM] Registrando Service Worker...');
            swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
              scope: '/',
              updateViaCache: 'none'
            });
            console.log('[FCM] ✅ SW registrado:', swRegistration.scope);
          }

          // ✅ Esperar que el SW esté activo
          await navigator.serviceWorker.ready;
          console.log('[FCM] ✅ SW listo');

        } catch (swErr) {
          console.warn('[FCM] Error con Service Worker:', swErr);
        }
      }

      // ✅ Obtener token de FCM
      console.log('[FCM] Solicitando token a Firebase...');
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: swRegistration
      });

      if (token) {
        console.log(`[FCM] ✅ Token ${forceRefresh ? 'renovado' : 'obtenido'}:`, token.substring(0, 30) + '...');
        this.saveTokenToCache(token);
        this.tokenSubject.next(token);
        return token;
      } else {
        console.warn('[FCM] No se pudo obtener token');
        return null;
      }

    } catch (error: any) {
      console.error('[FCM] Error obteniendo token:', error);
      
      // ✅ Si el error es por permisos, actualizar estado
      if (error.code === 'messaging/permission-blocked' || 
          error.code === 'messaging/permission-denied') {
        this.statusSubject.next('no-permission');
      }
      
      return null;
    }
  }

  // ─── Solicitar permiso y obtener token ──────────────────────────────────

  async solicitarPermisoYObtenerToken(forceRefresh: boolean = false): Promise<string | null> {
    if (!this.isSupported()) return null;

    if (this.statusSubject.value === 'not-initialized') {
      await this.initialize();
    }

    if (this.statusSubject.value !== 'ready') {
      console.warn('[FCM] No está listo. Estado:', this.statusSubject.value);
      return null;
    }

    let permiso = Notification.permission;
    if (permiso === 'default') {
      permiso = await Notification.requestPermission();
    }

    if (permiso !== 'granted') {
      console.warn('[FCM] Permiso denegado');
      this.statusSubject.next('no-permission');
      return null;
    }

    return this.obtenerToken(forceRefresh);
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

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

  // ─── Caché ────────────────────────────────────────────────────────────────

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