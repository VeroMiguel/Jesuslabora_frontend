import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl
} from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { ConfigService, AppConfig } from '../../core/services/config.service';
import { NotificationService } from '../../core/services/notification.service';
import { FirebaseMessagingService } from '../../core/services/firebase-messaging.service';
import { LogoService } from '../../core/services/logo.service';
@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.css']
})
export class ConfiguracionComponent implements OnInit, OnDestroy {

  form!: FormGroup;
  guardando = false;
  guardadoExitoso = false;
  solicitandoFcm = false;
  private sub?: Subscription;
    logoActualUrl: string | null = null;
  logoPreviewUrl: string | null = null;
  logoArchivo: File | null = null;
  subiendoLogo = false;

  // Opciones para el tiempo de cierre automático
  opcionesCierre = [
    { valor: 5, texto: '5 min' },
    { valor: 15, texto: '15 min' },
    { valor: 30, texto: '30 min' },
    { valor: 60, texto: '1 h' },
    { valor: 120, texto: '2 h' },
    { valor: 240, texto: '4 h' },
    { valor: 480, texto: '8 h' }
  ];

  // Opciones para el tiempo de notificación anticipada
  opcionesNotificacion = [
    { valor: 5, texto: '5 min' },
    { valor: 15, texto: '15 min' },
    { valor: 30, texto: '30 min' },
    { valor: 60, texto: '1 h' },
    { valor: 120, texto: '2 h' },
    { valor: 180, texto: '3 h' },
    { valor: 360, texto: '6 h' },
    { valor: 720, texto: '12 h' },
    { valor: 1440, texto: '24 h' }
  ];

  // Estado de permisos de notificación
  get permisoNotificacion(): string {
    return this.notificationService.estadoPermiso;
  }

  get swSoportado(): boolean {
    return 'serviceWorker' in navigator;
  }

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    public notificationService: NotificationService,
    public fcmService: FirebaseMessagingService,
   private logoService: LogoService  // ✅ AGREGAR
  ) {}

  ngOnInit(): void {
    const cfg = this.configService.config;

    this.form = this.fb.group({
      tiempoCierreAutomatico: [
        cfg.tiempoCierreAutomatico,
        [Validators.required, Validators.min(5), Validators.max(480)]
      ],
      tiempoNotificacionAnticipada: [
        cfg.tiempoNotificacionAnticipada,
        [Validators.required, Validators.min(5), Validators.max(1440)]
      ],
      notificacionesPushHabilitadas: [cfg.notificacionesPushHabilitadas],
      sonidoHabilitado: [cfg.sonidoHabilitado],
      vibracionHabilitada: [cfg.vibracionHabilitada]
    });
  // Cargar logo actual
    this.logoService.logo$.subscribe(url => {
      this.logoActualUrl = url;
    });
    this.logoService.cargarLogo();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }



onLogoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar tamaño (máx 2MB)
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire('Error', 'La imagen no puede superar los 2MB', 'error');
        return;
      }
      
      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        Swal.fire('Error', 'Formato no soportado. Use JPG, PNG, GIF o WEBP', 'error');
        return;
      }
      
      this.logoArchivo = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreviewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async guardarLogo() {
    if (!this.logoArchivo) return;
    
    this.subiendoLogo = true;
    
    try {
      await this.logoService.subirLogo(this.logoArchivo).toPromise();
      this.logoActualUrl = this.logoPreviewUrl;
      this.logoPreviewUrl = null;
      this.logoArchivo = null;
      
      Swal.fire({
        icon: 'success',
        title: 'Logo actualizado',
        text: 'El logo se ha guardado correctamente',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      
      // Recargar logo
      this.logoService.cargarLogo();
    } catch (error) {
      console.error('Error subiendo logo:', error);
      Swal.fire('Error', 'No se pudo guardar el logo', 'error');
    } finally {
      this.subiendoLogo = false;
    }
  }

  async removerLogo() {
    const result = await Swal.fire({
      title: '¿Eliminar logo?',
      text: 'El sistema usará el icono por defecto',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      this.subiendoLogo = true;
      try {
        await this.logoService.eliminarLogo().toPromise();
        this.logoActualUrl = null;
        this.logoPreviewUrl = null;
        this.logoArchivo = null;
        
        Swal.fire({
          icon: 'success',
          title: 'Logo eliminado',
          text: 'Se ha restaurado el icono por defecto',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        
        this.logoService.cargarLogo();
      } catch (error) {
        console.error('Error eliminando logo:', error);
        Swal.fire('Error', 'No se pudo eliminar el logo', 'error');
      } finally {
        this.subiendoLogo = false;
      }
    }
  }

  // ─── Helpers de template ─────────────────────────────────────────────────────

  get f(): { [key: string]: AbstractControl } {
    return this.form.controls;
  }

  formatMinutos(minutos: number): string {
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  // ─── Acciones ────────────────────────────────────────────────────────────────

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const config: AppConfig = this.form.value as AppConfig;

    setTimeout(() => {
      this.configService.saveConfig(config);
      this.guardando = false;
      this.guardadoExitoso = true;

      Swal.fire({
        icon: 'success',
        title: '¡Configuración guardada!',
        text: 'Los cambios se aplicarán de inmediato.',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      setTimeout(() => (this.guardadoExitoso = false), 3000);
    }, 400);
  }

  restaurarDefectos(): void {
    Swal.fire({
      title: '¿Restaurar valores por defecto?',
      text: 'Se perderán todos los ajustes personalizados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6366f1'
    }).then(result => {
      if (result.isConfirmed) {
        this.configService.resetToDefaults();
        const cfg = this.configService.config;
        this.form.patchValue(cfg);

        Swal.fire({
          icon: 'success',
          title: 'Valores restaurados',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      }
    });
  }

  async solicitarPermisoNotificacion(): Promise<void> {
    const concedido = await this.notificationService.solicitarPermiso();
    if (concedido) {
      Swal.fire({
        icon: 'success',
        title: '✅ Permiso concedido',
        text: 'Ahora recibirás notificaciones en este dispositivo.',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Permiso denegado',
        text: 'No podrás recibir notificaciones. Ve a la configuración del navegador para permitirlas.',
        confirmButtonColor: '#6366f1'
      });
    }
  }

  async activarNotificacionesFcm(): Promise<void> {
    this.solicitandoFcm = true;

    try {
        console.log('🔄 Iniciando renovación de token FCM...');
        
        const token = await this.fcmService.obtenerToken(true);
        
        if (!token) {
            throw new Error('No se pudo obtener token de FCM');
        }
        
        console.log('✅ Nuevo token obtenido:', token.substring(0, 30) + '...');
        
        const registrado = await this.notificationService.registrarTokenEnBackend(token);
        
        if (!registrado) {
            throw new Error('No se pudo registrar el token en el servidor');
        }
        
        localStorage.setItem('fcm_device_token', token);
        
        Swal.fire({
            icon: 'success',
            title: '✅ Token renovado correctamente',
            html: `
                <p>Las notificaciones push están activas en este dispositivo.</p>
                <details style="margin-top:1rem;text-align:left">
                    <summary style="cursor:pointer;color:#6366f1;font-size:0.85rem">Ver nuevo token</summary>
                    <code style="font-size:0.7rem;word-break:break-all;display:block;margin-top:0.5rem;padding:0.5rem;background:#f1f5f9;border-radius:6px">${token.substring(0, 50)}...</code>
                </details>
            `,
            confirmButtonColor: '#6366f1',
            confirmButtonText: 'Entendido'
        });
        
    } catch (error) {
        console.error('❌ Error renovando token:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error instanceof Error ? error.message : 'No se pudo renovar el token',
            confirmButtonColor: '#f43f5e'
        });
    } finally {
        this.solicitandoFcm = false;
    }
  }

  async probarNotificacion(): Promise<void> {
    const cfg: AppConfig = this.form.value as AppConfig;

    if (!cfg.notificacionesPushHabilitadas) {
      Swal.fire({
        icon: 'info',
        title: 'Notificaciones desactivadas',
        text: 'Activa las notificaciones push para probar esta función.',
        confirmButtonColor: '#6366f1'
      });
      return;
    }

    if (this.permisoNotificacion !== 'granted') {
      await this.solicitarPermisoNotificacion();
      if (this.permisoNotificacion !== 'granted') return;
    }

    if (cfg.vibracionHabilitada && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (cfg.sonidoHabilitado) {
      this.reproducirBeep();
    }

    this.notificationService.mostrarNotificacion(
      '🔔 Notificación de prueba',
      `Anticipación configurada: ${this.formatMinutos(cfg.tiempoNotificacionAnticipada)}`
    );

    Swal.fire({
      icon: 'success',
      title: '🔔 Notificación enviada',
      html: `
        <p>La notificación fue enviada a tu dispositivo.</p>
        <small style="color:#64748b">
          Anticipación configurada: <strong>${this.formatMinutos(cfg.tiempoNotificacionAnticipada)}</strong>
        </small>
      `,
      confirmButtonColor: '#6366f1',
      confirmButtonText: 'Entendido',
      timer: 3000,
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
      // El navegador puede bloquear AudioContext sin interacción previa
    }
  }
}