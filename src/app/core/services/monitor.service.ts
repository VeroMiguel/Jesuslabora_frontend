// monitor.service.ts - Versión mejorada
import { Injectable } from '@angular/core';
import { HttpRequest } from '@angular/common/http';
import { DebugService } from './debug.service';
import { environment } from '../../../environments/environment';

export interface RequestLogEntry {
  url: string;
  method: string;
  timestamp: Date;
  tokenPresent: boolean;
  status?: number;
  error?: any;
}

@Injectable({
  providedIn: 'root'
})
export class MonitorService {
  private requestLog: RequestLogEntry[] = [];
  private errorLog: RequestLogEntry[] = [];
  private isProduction = environment.production;

  constructor(private debugService: DebugService) {}

  logRequest(req: HttpRequest<any>, tokenPresent: boolean): void {
    // ✅ Solo almacenar, no loguear a menos que esté activado
    try {
      const entry: RequestLogEntry = {
        url: req.url,
        method: req.method,
        timestamp: new Date(),
        tokenPresent
      };

      this.requestLog.push(entry);

      if (this.requestLog.length > 50) {
        this.requestLog.shift();
      }

      // ✅ Solo mostrar en consola si debug está activado
      if (this.debugService.logRequests) {
        const shouldLog = req.url.includes('estadisticas') ? Math.random() < 0.1 : true;
        if (shouldLog) {
          console.log(`📡 [${entry.method}] ${entry.url.substring(0, 60)}...`);
        }
      }
    } catch (err) {
      if (!this.isProduction) {
        console.error('Error en logRequest:', err);
      }
    }
  }

  logError(req: HttpRequest<any>, error: any, status?: number): void {
    try {
      // No loguear errores 404 comunes
      if (status === 404 && req.url.includes('server-datetime')) {
        return;
      }

      const entry: RequestLogEntry = {
        url: req.url,
        method: req.method,
        timestamp: new Date(),
        tokenPresent: !!this.getTokenFromReq(req),
        status,
        error
      };

      this.errorLog.push(entry);

      if (this.errorLog.length > 20) {
        this.errorLog.shift();
      }

      // ✅ Solo mostrar errores graves en consola
      if (status && status >= 500) {
        console.error(`❌ Error ${status}: ${req.url}`);
      } else if (status && status >= 400 && status !== 404) {
        if (this.debugService.logRequests) {
          console.warn(`⚠️ Error ${status}: ${req.url}`);
        }
      }
    } catch (err) {
      if (!this.isProduction) {
        console.error('Error en logError:', err);
      }
    }
  }

  private getTokenFromReq(req: HttpRequest<any>): string | null {
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        return authHeader.replace('Bearer ', '');
      }
    } catch (err) {
      // Silenciar
    }
    return null;
  }

  getRequestLog(): RequestLogEntry[] {
    return this.requestLog;
  }

  getErrorLog(): RequestLogEntry[] {
    return this.errorLog;
  }

  getLastError(): RequestLogEntry | undefined {
    return this.errorLog[this.errorLog.length - 1];
  }

  clearLogs(): void {
    this.requestLog = [];
    this.errorLog = [];
  }
}