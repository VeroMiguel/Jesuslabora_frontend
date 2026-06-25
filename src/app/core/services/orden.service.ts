import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';  // ← AGREGAR HttpParams
import { Observable, throwError, timer } from 'rxjs';
import { retry, timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';


export interface Orden {
  id: number;
  id_externo: string;
  doctor_id: number;
  servicio_id: number;
  total: number;
  estado: 'pendiente'  | 'terminado';
  prioridad: 'normal' | 'urgente' | 'emergencia';
  fecha_inicio?: string;
  hora_inicio?: string;
  fecha_limite?: string;
  hora_limite?: string;
  cliente_nombre?: string;
  detalle_cliente?: string;  // <-- NUEVO CAMPO
  imagen_referencia_url?: string;
  doctor?: any;
  servicio?: any;
  pagos?: Array<{
    id: number;
    monto: number;
    metodo_pago: string;
    fecha_pago?: string;
    creado_en?: string;
  }>;
  detalles?: Array<{  // ← NUEVO: Agregar esta propiedad
    id: number;
    servicio_id: number;
    servicio?: any;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    fecha_limite?: string;
    hora_limite?: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class OrdenService {
  private apiUrl = `${environment.apiUrl}/ordenes`;

  constructor(private http: HttpClient) {}

  // Obtener todas las órdenes
  getOrdenes(): Observable<Orden[]> {
    return this.http.get<Orden[]>(this.apiUrl).pipe(
      timeout(10000), // 10 segundos de timeout
      retry(2), // Reintentar 2 veces si falla
      catchError(error => {
        console.error('Error en getOrdenes:', error);
        return throwError(() => error);
      })
    );
  }

  // Obtener una orden por ID
  getOrden(id: number): Observable<Orden> {
    return this.http.get<Orden>(`${this.apiUrl}/${id}`).pipe(
      timeout(10000),
      retry(2),
      catchError(error => {
        console.error(`Error en getOrden(${id}):`, error);
        return throwError(() => error);
      })
    );
  }

  // Obtener estadísticas
  getEstadisticas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estadisticas`).pipe(
      timeout(10000),
      retry(2),
      catchError(error => {
        console.error('Error en getEstadisticas:', error);
        return throwError(() => error);
      })
    );
  }

// Crear nueva orden (acepta cualquier objeto)
crearOrden(orden: any): Observable<any> {
  return this.http.post(this.apiUrl, orden).pipe(
    timeout(10000),
    catchError(error => {
      console.error('Error en crearOrden:', error);
      return throwError(() => error);
    })
  );
}

// Actualizar orden (acepta cualquier objeto)
actualizarOrden(id: number, orden: any): Observable<any> {
  return this.http.put(`${this.apiUrl}/${id}`, orden).pipe(
    timeout(10000),
    catchError(error => {
      console.error(`Error en actualizarOrden(${id}):`, error);
      return throwError(() => error);
    })
  );
}

  // Eliminar orden (soft delete)
  eliminarOrden(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      timeout(10000),
      catchError(error => {
        console.error(`Error en eliminarOrden(${id}):`, error);
        return throwError(() => error);
      })
    );
  }
  getFechaServidor(): Observable<{ fecha: string }> {
  return this.http.get<{ fecha: string }>(`${this.apiUrl}/server-time`); // Necesitas crear este endpoint en el backend
}
// Agregar este método a OrdenService
actualizarImagenReferencia(id: number, formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/imagen-referencia`, formData).pipe(
        timeout(10000),
        catchError(error => {
            console.error(`Error en actualizarImagenReferencia(${id}):`, error);
            return throwError(() => error);
        })
    );
}
crearOrdenConImagen(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData).pipe(
        timeout(10000),
        catchError(error => {
            console.error('Error en crearOrdenConImagen:', error);
            return throwError(() => error);
        })
    );
}

actualizarOrdenConImagen(id: number, formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, formData).pipe(
        timeout(10000),
        catchError(error => {
            console.error(`Error en actualizarOrdenConImagen(${id}):`, error);
            return throwError(() => error);
        })
    );
}

// orden.service.ts - Agregar este método

getFechaHoraServidor(): Observable<{ 
  fecha: string; 
  hora: string; 
  fecha_hora: string;
  timestamp: number;
  timezone: string;
  hoy: string;
  ahora_militar: string;
}> {
  return this.http.get<{
    fecha: string;
    hora: string;
    fecha_hora: string;
    timestamp: number;
    timezone: string;
    hoy: string;
    ahora_militar: string;
  }>(`${this.apiUrl}/server-datetime`).pipe(
    timeout(10000),
    retry(2),
    catchError(error => {
      console.error('Error obteniendo fecha/hora del servidor:', error);
      // Fallback a fecha local si hay error
      const ahoraLocal = new Date();
      const anio = ahoraLocal.getFullYear();
      const mes = String(ahoraLocal.getMonth() + 1).padStart(2, '0');
      const dia = String(ahoraLocal.getDate()).padStart(2, '0');
      const horas = String(ahoraLocal.getHours()).padStart(2, '0');
      const minutos = String(ahoraLocal.getMinutes()).padStart(2, '0');
      const segundos = String(ahoraLocal.getSeconds()).padStart(2, '0');
      
      return throwError(() => ({
        fecha: `${anio}-${mes}-${dia}`,
        hora: `${horas}:${minutos}:${segundos}`,
        fecha_hora: `${anio}-${mes}-${dia} ${horas}:${minutos}:${segundos}`,
        timestamp: ahoraLocal.getTime(),
        timezone: 'local',
        hoy: `${anio}-${mes}-${dia}`,
        ahora_militar: `${horas}:${minutos}`
      }));
    })
  );
}
// orden.service.ts - Agregar este método auxiliar

// Asegurar que la fecha límite se guarde correctamente
formatearFechaParaBackend(fecha: string): string {
  if (!fecha) return '';
  // Si ya viene en formato YYYY-MM-DD, devolver igual
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }
  // Si viene en otro formato, convertir
  const date = new Date(fecha);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// orden.service.ts - AGREGAR ESTE MÉTODO

getOrdenesConFiltros(filtros: {
    doctor_id?: string | number;
    fecha_inicio?: string;
    fecha_fin?: string;
    tipo_fecha?: 'registro' | 'limite';
    estado?: string;
}): Observable<any[]> {
    let params = new HttpParams();
    
    if (filtros.doctor_id && filtros.doctor_id !== 'todos') {
        params = params.set('doctor_id', filtros.doctor_id.toString());
    }
    if (filtros.fecha_inicio) params = params.set('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params = params.set('fecha_fin', filtros.fecha_fin);
    if (filtros.tipo_fecha) params = params.set('tipo_fecha', filtros.tipo_fecha);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    
    return this.http.get<any[]>(`${this.apiUrl}/filtros-avanzados`, { params }).pipe(
        timeout(10000),
        catchError(error => {
            console.error('Error en getOrdenesConFiltros:', error);
            return throwError(() => error);
        })
    );
}
// orden.service.ts - AGREGAR ESTOS MÉTODOS (después de los existentes)

// Subir imagen para un detalle específico (servicio)
subirImagenDetalle(detalleId: number, imagen: File): Observable<any> {
  const formData = new FormData();
  formData.append('imagen', imagen);
  
  return this.http.post(`${this.apiUrl}/detalles/${detalleId}/imagen`, formData).pipe(
    timeout(10000),
    catchError(error => {
      console.error(`Error subiendo imagen para detalle ${detalleId}:`, error);
      return throwError(() => error);
    })
  );
}

// Eliminar imagen de un detalle específico
eliminarImagenDetalle(detalleId: number): Observable<any> {
  return this.http.delete(`${this.apiUrl}/detalles/${detalleId}/imagen`).pipe(
    timeout(10000),
    catchError(error => {
      console.error(`Error eliminando imagen del detalle ${detalleId}:`, error);
      return throwError(() => error);
    })
  );
}
// orden.service.ts - AGREGAR ESTE MÉTODO

/**
 * Actualiza un detalle de orden específico (cliente_nombre y detalle_cliente)
 */
actualizarDetalleOrden(detalleId: number, data: { cliente_nombre?: string, detalle_cliente?: string }): Observable<any> {
  return this.http.put(`${this.apiUrl}/detalles/${detalleId}`, data).pipe(
    timeout(10000),
    catchError(error => {
      console.error(`Error en actualizarDetalleOrden(${detalleId}):`, error);
      return throwError(() => error);
    })
  );
}

}