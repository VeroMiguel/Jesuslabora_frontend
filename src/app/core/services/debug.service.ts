import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface DebugFlags {
  requests: boolean;    // Mostrar logs de peticiones HTTP
  images: boolean;      // Mostrar logs de imágenes
  selects: boolean;     // Mostrar logs de selects
  vencidas: boolean;    // Mostrar logs de fechas vencidas
  pagination: boolean;  // Mostrar logs de paginación
  notifications: boolean; // Mostrar logs de notificaciones
}

const DEFAULT_FLAGS: DebugFlags = {
  requests: false,
  images: false,
  selects: false,
  vencidas: false,
  pagination: false,
  notifications: false
};

@Injectable({
  providedIn: 'root'
})
export class DebugService {
  private flags: DebugFlags;
  private readonly isProduction = environment.production;

  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.loadFromStorage();
    
    // En desarrollo, mostrar ayuda en consola
    if (!this.isProduction) {
      this.showHelp();
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('debug_flags');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.flags = { ...DEFAULT_FLAGS, ...parsed };
      }
    } catch (e) {
      console.warn('Error cargando flags de debug:', e);
    }
  }

  private saveToStorage(): void {
    localStorage.setItem('debug_flags', JSON.stringify(this.flags));
  }

  private showHelp(): void {
    console.log(
      '%c🐛 SISTEMA DE DEBUG ACTIVADO',
      'background: #6366f1; color: white; padding: 4px 8px; border-radius: 4px;'
    );
    console.log(`
Comandos disponibles:
  debug.all()          - Activar todos los logs
  debug.none()         - Desactivar todos los logs
  debug.requests()     - Ver logs de peticiones HTTP
  debug.images()       - Ver logs de imágenes
  debug.selects()      - Ver logs de selects
  debug.vencidas()     - Ver logs de fechas vencidas
  debug.pagination()   - Ver logs de paginación
  debug.notifications() - Ver logs de notificaciones
  debug.status()       - Ver estado actual
  debug.help()         - Mostrar esta ayuda
    `);
  }

  // Getters para verificar si un flag está activo
  get logRequests(): boolean {
    return !this.isProduction && this.flags.requests;
  }

  get logImages(): boolean {
    return !this.isProduction && this.flags.images;
  }

  get logSelects(): boolean {
    return !this.isProduction && this.flags.selects;
  }

  get logVencidas(): boolean {
    return !this.isProduction && this.flags.vencidas;
  }

  get logPagination(): boolean {
    return !this.isProduction && this.flags.pagination;
  }

  get logNotifications(): boolean {
    return !this.isProduction && this.flags.notifications;
  }

  // Métodos para controlar flags
  enable(flag: keyof DebugFlags): void {
    this.flags[flag] = true;
    this.saveToStorage();
    console.log(`✅ Debug "${flag}" activado`);
  }

  disable(flag: keyof DebugFlags): void {
    this.flags[flag] = false;
    this.saveToStorage();
    console.log(`❌ Debug "${flag}" desactivado`);
  }

  toggle(flag: keyof DebugFlags): boolean {
    this.flags[flag] = !this.flags[flag];
    this.saveToStorage();
    console.log(`${this.flags[flag] ? '✅' : '❌'} Debug "${flag}" ${this.flags[flag] ? 'activado' : 'desactivado'}`);
    return this.flags[flag];
  }

  all(): void {
    Object.keys(this.flags).forEach(key => {
      this.flags[key as keyof DebugFlags] = true;
    });
    this.saveToStorage();
    console.log('✅ Todos los logs de debug activados');
  }

  none(): void {
    Object.keys(this.flags).forEach(key => {
      this.flags[key as keyof DebugFlags] = false;
    });
    this.saveToStorage();
    console.log('❌ Todos los logs de debug desactivados');
  }

  status(): void {
    console.table(this.flags);
  }

  help(): void {
    this.showHelp();
  }
}

// Exportar función para usar en consola
export function setupDebugCommands(debugService: DebugService): void {
  (window as any).debug = {
    all: () => debugService.all(),
    none: () => debugService.none(),
    requests: () => debugService.toggle('requests'),
    images: () => debugService.toggle('images'),
    selects: () => debugService.toggle('selects'),
    vencidas: () => debugService.toggle('vencidas'),
    pagination: () => debugService.toggle('pagination'),
    notifications: () => debugService.toggle('notifications'),
    status: () => debugService.status(),
    help: () => debugService.help(),
    // Comandos directos
    on: (flag: string) => debugService.enable(flag as keyof DebugFlags),
    off: (flag: string) => debugService.disable(flag as keyof DebugFlags)
  };
  console.log('🐛 Comandos de debug disponibles. Escribe "debug.help()" para ver opciones.');
}