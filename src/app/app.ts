import { Component, OnInit, HostListener, Renderer2, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { SessionService } from './core/services/session.service';
import { NotificationService } from './core/services/notification.service';
import { FirebaseMessagingService } from './core/services/firebase-messaging.service';
import { SessionTimeoutComponent } from './shared/components/session-timeout/session-timeout.component';
import { environment } from '../environments/environment';  // ✅ AGREGAR ESTA LÍNEA
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SessionTimeoutComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';
  currentTheme: string = 'dark';
  menuOpen: boolean = false;
  private authSubscription?: Subscription;
  private originalOverflow: string = '';
  
  // app.ts - Modificar el constructor

constructor(
    public authService: AuthService,
    private renderer: Renderer2,
    private router: Router,
    private sessionService: SessionService,
    private notificationService: NotificationService,
    private fcmService: FirebaseMessagingService
  ) {
    this.currentTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', this.currentTheme);

    this.registrarServiceWorker();

    // ✅ Solo inicializar FCM en producción
    if (environment.production && environment.enableFirebase !== false) {
        this.fcmService.initialize().then(() => {
            console.log('[App] Firebase Messaging inicializado');
        });
    } else {
        console.log('[App] Firebase Messaging deshabilitado en desarrollo');
    }
    
    this.solicitarPermisosIniciales();
}

  ngOnInit() {
    this.registrarServiceWorker();
    
    this.authSubscription = this.authService.authLoading$.subscribe((loading) => {
      if (!loading) {
        if (this.authService.isAuthenticated()) {
          // ✅ Solo iniciar SessionService, no hay timer duplicado
          this.sessionService.iniciar();
          this.notificationService.solicitarPermiso();
        } else if (this.router.url !== '/login') {
          this.sessionService.detener();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  private solicitarPermisosIniciales(): void {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      if (Notification.permission === 'default') {
        setTimeout(() => {
          Notification.requestPermission().then(permiso => {
            console.log('[App] Permiso de notificaciones inicial:', permiso);
          });
        }, 3000);
      }
    }
    
    if ('Notification' in window && 'serviceWorker' in navigator) {
      console.log('[App] Notificaciones soportadas en este navegador');
    }
  }

// app.ts - Modificar el método registrarServiceWorker

private registrarServiceWorker(): void {
    // ✅ Solo registrar SW en producción, no en desarrollo local
    if (!environment.production) {
        console.log('[App] Service Worker deshabilitado en modo desarrollo');
        return;
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').then(reg => {
            console.log('[App] Service Worker registrado:', reg.scope);
        }).catch(err => {
            console.warn('[App] Error registrando Service Worker:', err);
        });
    }
}

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.sessionService.detener();
    if (this.menuOpen) {
      this.restoreBodyScroll();
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      this.disableBodyScroll();
      this.renderer.addClass(document.body, 'menu-open');
    } else {
      this.restoreBodyScroll();
      this.renderer.removeClass(document.body, 'menu-open');
    }
  }

  closeMenu() {
    if (this.menuOpen) {
      this.menuOpen = false;
      this.restoreBodyScroll();
      this.renderer.removeClass(document.body, 'menu-open');
    }
  }
  
  private disableBodyScroll() {
    this.originalOverflow = document.body.style.overflow;
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
    const scrollY = window.scrollY;
    this.renderer.setStyle(document.body, 'position', 'fixed');
    this.renderer.setStyle(document.body, 'top', `-${scrollY}px`);
    this.renderer.setStyle(document.body, 'width', '100%');
  }
  
  private restoreBodyScroll() {
    const scrollY = document.body.style.top;
    this.renderer.setStyle(document.body, 'overflow', this.originalOverflow);
    this.renderer.setStyle(document.body, 'position', '');
    this.renderer.setStyle(document.body, 'top', '');
    this.renderer.setStyle(document.body, 'width', '');
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
    }
  }

  closeMenuIfClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.nav-menu') && !target.closest('.menu-toggle')) {
      this.closeMenu();
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth > 768 && this.menuOpen) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress() {
    if (this.menuOpen) {
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.menuOpen && window.innerWidth <= 768) {
      this.closeMenuIfClickOutside(event);
    }
  }

  get isDarkTheme(): boolean {
    return this.currentTheme === 'dark';
  }
}