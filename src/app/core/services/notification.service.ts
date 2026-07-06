// core/services/notification.service.ts - VERSIÓN COMPLETA CORREGIDA
import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { ConfigService, AppConfig } from './config.service';
import { FirebaseMessagingService, FcmMessage } from './firebase-messaging.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface NotificacionProgramada {
  id: string;
  titulo: string;
  cuerpo: string;
  fechaDisparo: Date;
  timerId?: any;
}

export interface ResultadoProgramacion {
  programadas: number;
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {

  private readonly STORAGE_KEY = 'notificaciones_programadas';
  private notificaciones = new Map<string, NotificacionProgramada>();
  private config!: AppConfig;
  private configSub?: Subscription;
  private fcmSub?: Subscription;

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private fcmService: FirebaseMessagingService
  ) {
    this.configSub = this.configService.config$.subscribe(cfg => {
      this.config = cfg;
    });

    this.fcmSub = this.fcmService.message$.subscribe(msg => {
      if (msg) this.mostrarMensajeFcmEnForeground(msg);
    });

    this.restaurarPendientes();
  }

  // ─── Registrar token en backend ──────────────────────────────────────────

  async registrarTokenEnBackend(token: string): Promise<boolean> {
    try {
      const usuario = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await this.http.post(`${environment.apiUrl}/notificaciones/registrar-token`, {
        token,
        dispositivo: navigator.userAgent,
        plataforma: this.getPlataforma()
      }).toPromise();
      
      console.log('[Notif] ✅ Token registrado en backend:', response);
      return true;
    } catch (error) {
      console.error('[Notif] ❌ Error registrando token en backend:', error);
      return false;
    }
  }

  async eliminarTokenEnBackend(token: string): Promise<void> {
    try {
      await this.http.delete(`${environment.apiUrl}/notificaciones/eliminar-token`, {
        body: { token }
      }).toPromise();
      console.log('[Notif] Token eliminado del backend');
    } catch (error) {
      console.error('[Notif] Error eliminando token:', error);
    }
  }

  private getPlataforma(): string {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/windows/i.test(ua)) return 'windows';
    if (/mac/i.test(ua)) return 'mac';
    return 'web';
  }

  ngOnDestroy(): void {
    this.configSub?.unsubscribe();
    this.fcmSub?.unsubscribe();
  }

  // ─── Permisos ─────────────────────────────────────────────────────────────

  async solicitarPermiso(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[Notif] Navegador no soporta notificaciones');
      return false;
    }

    let permiso = Notification.permission;

    if (permiso === 'default') {
      permiso = await Notification.requestPermission();
    }

    const concedido = permiso === 'granted';
    console.log(`[Notif] Permiso de notificaciones: ${permiso}`);

    if (concedido) {
      const token = await this.fcmService.solicitarPermisoYObtenerToken();
      if (token) {
        console.log('[Notif] Token FCM obtenido:', token);
        await this.registrarTokenEnBackend(token);
      }
    }
    return concedido;
  }

  get tienePermiso(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  get estadoPermiso(): string {
    if (!('Notification' in window)) return 'no-soportado';
    return Notification.permission;
  }

  get tokenFcm(): string | null {
    return this.fcmService.tokenActual;
  }

  get fcmListo(): boolean {
    return this.fcmService.estaListo;
  }

  get fcmConfigurado(): boolean {
    return this.fcmService.tieneConfigReal;
  }

  // ─── Programar notificación ───────────────────────────────────────────────

  programarNotificacion(
    id: string,
    titulo: string,
    cuerpo: string,
    fechaHora: Date,
    minutosAntes: number = 0
  ): boolean {
    if (!this.tienePermiso) {
      console.warn('[Notif] Sin permiso para programar notificaciones');
      return false;
    }

    const fechaDisparo = new Date(fechaHora.getTime() - minutosAntes * 60_000);
    const msHasta = fechaDisparo.getTime() - Date.now();

    if (msHasta <= 0) {
      console.warn(`[Notif] Fecha de disparo ya pasó para "${id}"`);
      return false;
    }

    this.cancelarNotificacion(id);

    const notif: NotificacionProgramada = { id, titulo, cuerpo, fechaDisparo };

    notif.timerId = setTimeout(() => {
      this.disparar(titulo, cuerpo, id);
      this.notificaciones.delete(id);
      this.persistir();
    }, msHasta);

    this.notificaciones.set(id, notif);
    this.persistir();

    const min = Math.round(msHasta / 60_000);
    console.log(`[Notif] ✅ "${id}" programada en ${min} min`);
    return true;
  }

  mostrarNotificacion(titulo: string, cuerpo: string, tag?: string): void {
    if (!this.tienePermiso) return;

    try {
      const notif = new Notification(titulo, {
        body: cuerpo,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: tag ?? `notif-${Date.now()}`,
        requireInteraction: false,
        silent: false
      } as NotificationOptions);

      notif.onclick = () => { window.focus(); notif.close(); };
    } catch (err) {
      console.error('[Notif] Error mostrando notificación nativa:', err);
    }
  }

  cancelarNotificacion(id: string): void {
    const notif = this.notificaciones.get(id);
    if (notif?.timerId) {
      clearTimeout(notif.timerId);
      this.notificaciones.delete(id);
      this.persistir();
    }
  }

  cancelarTodasLasNotificaciones(): void {
    this.notificaciones.forEach(n => {
      if (n.timerId) clearTimeout(n.timerId);
    });
    this.notificaciones.clear();
    this.persistir();
    console.log('[Notif] Todas las notificaciones canceladas');
  }

  // ─── Helper para órdenes ──────────────────────────────────────────────────

  /**
   * ✅ VERSIÓN CORREGIDA - Usa el endpoint /programar que funciona
   */
  async programarNotificacionOrden(orden: {
    id: number | string;
    id_externo: string;
    detalles?: Array<{
      id: number;
      servicio?: { nombre: string };
      fecha_limite: string;
      hora_limite?: string;
      cliente_nombre?: string;
    }>;
    doctor?: { nombre: string };
    cliente_nombre?: string;
  }): Promise<ResultadoProgramacion> {
    
    if (!orden.detalles || orden.detalles.length === 0) {
      return { programadas: 0, mensaje: 'La orden no tiene servicios' };
    }
    
    const doctor = orden.doctor?.nombre ?? 'Doctor';
    let programadas = 0;
    const mensajes: string[] = [];
    
    // ✅ Programar notificaciones locales (foreground)
    for (const detalle of orden.detalles) {
      if (!detalle.fecha_limite) continue;
      
      const horaStr = detalle.hora_limite || '08:00';
      const fechaHora = new Date(`${detalle.fecha_limite}T${horaStr}`);
      
      if (isNaN(fechaHora.getTime()) || fechaHora <= new Date()) continue;
      
      const servicio = detalle.servicio?.nombre ?? 'Servicio';
      const cliente = detalle.cliente_nombre ?? orden.cliente_nombre;
      const clienteTexto = cliente ? ` | ${cliente}` : '';
      const cuerpo = `${doctor} — ${servicio}${clienteTexto}`;
      const idBase = `orden-${orden.id}-servicio-${detalle.id}`;
      
      // Notificación a la hora exacta
      const ok1 = this.programarNotificacion(
        `${idBase}-exacta`,
        `📋 Orden ${orden.id_externo} — ¡Hora límite!`,
        `⏰ Vence AHORA: ${cuerpo}`,
        fechaHora,
        0
      );
      if (ok1) programadas++;
      
      // Notificación anticipada
      const leadMin = this.config?.tiempoNotificacionAnticipada ?? 30;
      const ok2 = this.programarNotificacion(
        `${idBase}-anticipada`,
        `⚠️ Orden ${orden.id_externo} — "${servicio}" vence en ${leadMin} min`,
        cuerpo,
        fechaHora,
        leadMin
      );
      if (ok2) programadas++;
      
      mensajes.push(`${servicio}: ${fechaHora.toLocaleString('es-PE')}`);
    }
    
    // ✅ NUEVO: Programar push en backend usando el endpoint /programar (que funciona)
    const ordenIdNumerico = typeof orden.id === 'string' ? parseInt(orden.id) || 0 : orden.id;
    
    if (ordenIdNumerico > 0) {
      try {
        const leadMin = this.config?.tiempoNotificacionAnticipada ?? 30;
        
        console.log(`[Notif] 📨 Programando push en backend para orden ${ordenIdNumerico}...`);
        
        // ✅ Programar notificación ANTICIPADA
        const response1 = await this.http.post(`${environment.apiUrl}/notificaciones/programar`, {
          ordenId: ordenIdNumerico,
          minutosAntes: leadMin
        }).toPromise();
        console.log(`[Notif] ✅ Push anticipada programada (${leadMin} min):`, response1);
        
        // ✅ Programar notificación EXACTA
        const response2 = await this.http.post(`${environment.apiUrl}/notificaciones/programar`, {
          ordenId: ordenIdNumerico,
          minutosAntes: 0
        }).toPromise();
        console.log(`[Notif] ✅ Push exacta programada:`, response2);
        
        // ✅ También programar para 30 min (si la anticipación es diferente)
        if (leadMin !== 30) {
          const response3 = await this.http.post(`${environment.apiUrl}/notificaciones/programar`, {
            ordenId: ordenIdNumerico,
            minutosAntes: 30
          }).toPromise();
          console.log(`[Notif] ✅ Push 30min programada:`, response3);
        }
        
        console.log(`[Notif] 📨 ${orden.detalles.length} servicio(s) programados en backend`);
        
      } catch (error) {
        console.error('[Notif] ❌ Error programando push en backend:', error);
        // No mostrar error al usuario, la orden ya está creada
      }
    }
    
    let mensaje = `${programadas} notificación(es) programadas para ${orden.detalles.length} servicio(s)`;
    if (programadas > 0 && mensajes.length > 0) {
      mensaje += `: ${mensajes.join(', ')}`;
    }
    
    return { programadas, mensaje };
  }

  // ─── Estado ───────────────────────────────────────────────────────────────

  getNotificacionesPendientes(): NotificacionProgramada[] {
    return Array.from(this.notificaciones.values());
  }

  tieneNotificacionParaOrden(ordenId: number | string): boolean {
    return (
      this.notificaciones.has(`orden-${ordenId}-exacta`) ||
      this.notificaciones.has(`orden-${ordenId}-anticipada`) ||
      this.notificaciones.has(`orden-${ordenId}-30min`)
    );
  }

  // ─── Privados ─────────────────────────────────────────────────────────────

  private disparar(titulo: string, cuerpo: string, tag: string): void {
    if (this.config?.vibracionHabilitada && 'vibrate' in navigator) {
      navigator.vibrate([150, 80, 150]);
    }

    if (this.config?.sonidoHabilitado) {
      this.reproducirBeep();
    }

    this.mostrarNotificacion(titulo, cuerpo, tag);

    Swal.fire({
      icon: 'warning',
      title: titulo,
      html: `<span style="color:#f59e0b">${cuerpo}</span>`,
      toast: true,
      position: 'top-end',
      timer: 7000,
      showConfirmButton: false,
      timerProgressBar: true
    });
  }

  private mostrarMensajeFcmEnForeground(msg: FcmMessage): void {
    if (this.config?.vibracionHabilitada && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (this.config?.sonidoHabilitado) {
      this.reproducirBeep();
    }

    this.mostrarNotificacion(msg.title, msg.body, msg.tag);

    Swal.fire({
      icon: 'info',
      title: msg.title,
      html: `<span>${msg.body}</span>`,
      toast: true,
      position: 'top-end',
      timer: 8000,
      showConfirmButton: false,
      timerProgressBar: true
    });
  }

  private reproducirBeep(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext puede estar bloqueado sin interacción previa
    }
  }

  // ─── Persistencia ─────────────────────────────────────────────────────────

  private persistir(): void {
    try {
      const datos = Array.from(this.notificaciones.values()).map(n => ({
        id: n.id,
        titulo: n.titulo,
        cuerpo: n.cuerpo,
        fechaDisparo: n.fechaDisparo.toISOString()
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(datos));
    } catch (err) {
      console.error('[Notif] Error persistiendo notificaciones:', err);
    }
  }

  private restaurarPendientes(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;

      const datos: Array<{
        id: string;
        titulo: string;
        cuerpo: string;
        fechaDisparo: string;
      }> = JSON.parse(raw);

      const ahora = new Date();
      let restauradas = 0;

      datos.forEach(d => {
        const fechaDisparo = new Date(d.fechaDisparo);
        if (fechaDisparo > ahora) {
          const msHasta = fechaDisparo.getTime() - ahora.getTime();
          const notif: NotificacionProgramada = {
            id: d.id,
            titulo: d.titulo,
            cuerpo: d.cuerpo,
            fechaDisparo
          };
          notif.timerId = setTimeout(() => {
            this.disparar(d.titulo, d.cuerpo, d.id);
            this.notificaciones.delete(d.id);
            this.persistir();
          }, msHasta);
          this.notificaciones.set(d.id, notif);
          restauradas++;
        }
      });

      if (restauradas > 0) {
        console.log(`[Notif] 🔄 ${restauradas} notificación(es) restaurada(s)`);
      }

      this.persistir();
    } catch (err) {
      console.error('[Notif] Error restaurando notificaciones:', err);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}