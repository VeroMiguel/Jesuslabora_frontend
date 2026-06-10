// auth.interceptor.fn.ts - Versión mejorada
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MonitorService } from '../services/monitor.service';
import { DebugService } from '../services/debug.service';
import Swal from 'sweetalert2';

const excludedUrls = ['/auth/login', '/auth/verificar', '/health', '/ping'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const monitor = inject(MonitorService);
  const debug = inject(DebugService);
  
  const isExcludedUrl = excludedUrls.some(url => req.url.includes(url));
  
  if (isExcludedUrl) {
    return next(req);
  }
  
  let token: string | null = null;
  try {
    token = authService?.getToken ? authService.getToken() : null;
  } catch (err) {
    return next(req);
  }
  
  const tokenPresent = !!token;
  
  // ✅ Logs reducidos
  if (debug.logRequests && tokenPresent && token) {
    // Solo mostrar URLs no repetitivas
    if (!req.url.includes('estadisticas') || Math.random() < 0.05) {
      console.log(`🔑 [${req.method}] ${req.url.substring(0, 50)}...`);
    }
  }
  
  if (monitor) {
    monitor.logRequest(req, tokenPresent);
  }
  
  let authReq = req;
  if (tokenPresent && token) {
    const isFormData = req.body instanceof FormData;
    
    let headers: any = {
      Authorization: `Bearer ${token}`
    };
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    authReq = req.clone({
      setHeaders: headers
    });
  }

  return next(authReq).pipe(
    timeout(30000),
    catchError((error: any) => {
      if (monitor) {
        monitor.logError(req, error.error, error.status);
      }
      
      // ✅ Solo mostrar errores que importan
      if (error.status === 401 && !req.url.includes('/auth/verificar')) {
        console.warn('⚠️ Sesión expirada');
        
        Swal.fire({
          icon: 'error',
          title: 'Sesión expirada',
          text: 'Por favor, inicie sesión nuevamente',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          authService.logout();
        });
      } else if (error.status === 403) {
        Swal.fire({
          icon: 'error',
          title: 'Acceso denegado',
          text: 'No tiene permisos para realizar esta acción',
          timer: 3000
        });
      } else if (debug.logRequests && error.status && error.status !== 404) {
        console.error(`❌ Error ${error.status}: ${req.url}`);
      }
      
      return throwError(() => error);
    })
  );
};