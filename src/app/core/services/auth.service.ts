import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, finalize, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private authLoadingSubject = new BehaviorSubject<boolean>(true);
  public authLoading$ = this.authLoadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredUser();
  }

  private loadStoredUser() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      this.currentUserSubject.next(JSON.parse(user));
      this.verificarTokenEnBackend(token);
    } else {
      this.authLoadingSubject.next(false);
    }
  }

// auth.service.ts - Modificar verificarTokenEnBackend

private verificarTokenEnBackend(token: string) {
    if (!token) {
        console.warn('⚠️ No hay token para verificar');
        this.authLoadingSubject.next(false);
        return;
    }
    
    // ✅ Si ya estamos en /login, no verificar
    if (this.router.url === '/login') {
        this.authLoadingSubject.next(false);
        return;
    }
    
    const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    });

    console.log('🔍 Verificando token...');
    
    this.http.get(`${this.apiUrl}/verificar`, { headers }).pipe(
        timeout(5000), // Reducir timeout a 5 segundos
        catchError((error) => {
            // ✅ Si el backend no responde (503), mantener sesión local
            if (error.status === 503 || error.status === 0) {
                console.warn('⚠️ Backend no disponible, manteniendo sesión local');
                return of({ valido: true, usuario: JSON.parse(localStorage.getItem('user') || '{}') });
            }
            
            if (error.status === 401) {
                console.error('❌ Token inválido o expirado');
                this.logoutSilently();
            } else if (error.status !== 404) {
                console.warn(`⚠️ Error ${error.status}, manteniendo sesión local`);
            }
            return of(null);
        }),
        finalize(() => {
            this.authLoadingSubject.next(false);
        })
    ).subscribe({
        next: (response: any) => {
            if (response && response.valido) {
                console.log('✅ Token válido');
                if (response.usuario) {
                    this.currentUserSubject.next(response.usuario);
                    localStorage.setItem('user', JSON.stringify(response.usuario));
                }
            }
        }
    });
}

  private logoutSilently() {
    console.log('🚪 Cerrando sesión silenciosamente');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    
    if (this.router.url !== '/login') {
      this.router.navigate(['/login']);
    }
  }

  login(credentials: { nombre_usuario: string, contrasena: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      timeout(10000),
      tap((response: any) => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.usuario));
        this.currentUserSubject.next(response.usuario);
        
        Swal.fire({
          icon: 'success',
          title: '¡Bienvenido!',
          text: `Hola ${response.usuario.nombre_completo}`,
          timer: 1500,
          showConfirmButton: false
        });
      }),
      catchError((error) => {
        console.error('❌ Error en login:', error);
        return of(error);
      })
    );
  }

  logout() {
    Swal.fire({
      title: '¿Cerrar sesión?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
      }
    });
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isLoading(): boolean {
    return this.authLoadingSubject.value;
  }

  hasRole(role: string): boolean {
    const user = this.currentUserSubject.value;
    return user && user.rol === role;
  }
}