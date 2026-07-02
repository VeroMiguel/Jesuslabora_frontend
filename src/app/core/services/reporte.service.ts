import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private apiUrl = `${environment.apiUrl}/reportes`;

  constructor(private http: HttpClient) {}

  getReporteIngresos(fechaInicio: string, fechaFin: string, grupo: string = 'mes'): Observable<any> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin)
      .set('grupo', grupo);
    return this.http.get(`${this.apiUrl}/ingresos`, { params });
  }

  // ✅ MODIFICADO: Acepta parámetros de filtro
  getReporteDoctores(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.tipo_cliente) {
        httpParams = httpParams.set('tipo_cliente', params.tipo_cliente);
      }
      if (params.mes) {
        httpParams = httpParams.set('mes', params.mes);
      }
    }
    
    return this.http.get(`${this.apiUrl}/doctores`, { params: httpParams }).pipe(
      map((data: any) => {
        const doctores = data.doctores.map((doctor: any) => ({
          ...doctor,
          id: doctor.doctorId || doctor.id,
          telefono_whatsapp: doctor.telefono || doctor.telefono_whatsapp,
          proxima_entrega: doctor.proxima_entrega || this.calcularProximaEntrega(doctor.ordenes)
        }));
        return {
          ...data,
          doctores
        };
      })
    );
  }

  private calcularProximaEntrega(ordenes: any[]): string | null {
    if (!ordenes || ordenes.length === 0) return null;
    const pendientes = ordenes
      .filter(o => o.estado === 'pendiente' && o.fecha_limite)
      .sort((a, b) => new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime());
    return pendientes.length > 0 ? pendientes[0].fecha_limite : null;
  }

  getReporteServicios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/servicios`);
  }

  getReporteMorosidad(): Observable<any> {
    return this.http.get(`${this.apiUrl}/morosidad`);
  }

  getReporteProductividad(): Observable<any> {
    return this.http.get(`${this.apiUrl}/productividad`);
  }

  exportarExcel(tipo: string, params?: any): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        httpParams = httpParams.set(key, params[key]);
      });
    }
    return this.http.get(`${this.apiUrl}/exportar/${tipo}`, {
      params: httpParams,
      responseType: 'blob'
    });
  }

  getTendenciaMensual(): Observable<any> {
    return this.http.get(`${this.apiUrl}/tendencia-mensual`);
  }

// reporte.service.ts - MODIFICAR exportarReportePorDoctor

exportarReportePorDoctor(doctorId: number, paciente?: string): Observable<Blob> {
    let url = `${this.apiUrl}/exportar/doctor/${doctorId}`;
    
    // ✅ Si hay filtro por paciente, agregarlo como query param
    if (paciente && paciente.trim() !== '') {
        url += `?paciente=${encodeURIComponent(paciente)}`;
    }
    
    return this.http.get(url, {
        responseType: 'blob'
    });
}
}