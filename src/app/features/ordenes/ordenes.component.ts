import { DebugService } from '../../core/services/debug.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OrdenService } from '../../core/services/orden.service';
import { AuthService } from '../../core/services/auth.service';
import { PagoService } from '../../core/services/pago.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { MonedaPipe } from '../../shared/pipes/moneda.pipe';
import { FechaPipe } from '../../shared/pipes/fecha.pipe';
import { HoraPipe } from 'src/app/shared/pipes/hora.pipe';
import { ImageZoomComponent } from '../../shared/components/image-zoom/image-zoom.component'; // <-- IMPORTAR
import Swal from 'sweetalert2';
import { ImagenPipe } from '../../shared/pipes/imagen.pipe';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { TicketService } from '../../core/services/ticket.service';
import { WhatsAppService } from '../../core/services/whatsapp.service';
import { saveAs } from 'file-saver';
import { HttpClient } from '@angular/common/http'; // <-- AGREGAR ESTO
import { CalendarioFiltroComponent } from './components/calendario-filtro/calendario-filtro.component'; // ← AGREGAR
@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    LoadingSpinnerComponent,
    MonedaPipe,
    FechaPipe,
    HoraPipe,
    ImagenPipe,
    SearchableSelectComponent,
     ImageZoomComponent,
    CalendarioFiltroComponent  // ← AGREGAR AQUÍ
  ],
  templateUrl: './ordenes.component.html',
  styleUrls: ['./ordenes.component.css'],
  providers: [MonedaPipe] // <-- AGREGAR ESTO
})
export class OrdenesComponent implements OnInit, OnDestroy {
   private subscriptions: Subscription[] = [];
  ordenes: any[] = [];
  ordenesFiltradas: any[] = [];
  // Agregar estas propiedades
doctoresCompleto: any[] = [];
serviciosCompleto: any[] = [];
paginaActual: number = 1;
itemsPorPagina: number = 5;
totalPaginas: number = 1;
ordenesPaginadas: any[] = [];
// ordenes.component.ts - Agregar después de fechaServidorHoy
fechaServidorHoy: string = '';
fechaHoraServidor: string = '';  // NUEVO: fecha y hora completa
fechaHoraTimestamp: number = 0;   // NUEVO: timestamp para comparaciones
ordenesSeleccionadas: any[] = [];
    // Filtros avanzados
  filtros = {
    busquedaGlobal: '',
    doctor: '',
    servicio: '',
    estado: '',
    prioridad: '',
    cliente: '',
    fechaInicio: '',
    fechaFin: '',
    saldoMin: null as number | null,
    saldoMax: null as number | null,
    vencidas: false as boolean,
     ocultarTerminadas: true as boolean  // <-- AGREGAR ESTA LÍNEA
  };

  // Para los selects de filtros
  doctoresUnicos: string[] = [];
  serviciosUnicos: string[] = [];
  mostrarFiltrosAvanzados = false;
  
  cargando = true;

 // Clave para localStorage
  private readonly FILTROS_STORAGE_KEY = 'ordenes_filtros';
  private readonly FILTROS_VISIBLES_KEY = 'ordenes_filtros_visibles';
 calendarioVisible: boolean = true;  // ✅ Nueva propiedad
  private readonly CALENDARIO_VISIBLE_KEY = 'calendario_visible';


// AGREGAR ESTE GETTER (después de las propiedades)
get ordenesActivas(): any[] {
  return this.ordenes.filter(orden => {
    const saldo = this.calcularSaldo(orden);
    return orden.estado === 'pendiente' && saldo > 0;
  });
}


 // Agregar en el constructor:
constructor(
  private ordenService: OrdenService,
  private pagoService: PagoService,  // Agregar esta línea
  private authService: AuthService,
  private monedaPipe: MonedaPipe, // <-- AGREGAR ESTO
  private ticketService: TicketService,
  private whatsAppService: WhatsAppService, // <-- AGREGAR ESTO
   private http: HttpClient,
  private debugService: DebugService  // ✅ Agregar esta línea
) {}



// ordenes.component.ts - Modificar ngOnInit

// ordenes.component.ts - Asegurar que la fecha se muestre en hora Perú

ngOnInit() {
  // ✅ Restaurar estado del calendario
  const guardado = localStorage.getItem(this.CALENDARIO_VISIBLE_KEY);
  this.calendarioVisible = guardado !== null ? guardado === 'true' : true;
  
  // Restaurar filtros guardados
  this.restaurarFiltros();

  // Obtener la fecha y hora del servidor PRIMERO
  this.subscriptions.push(
    this.ordenService.getFechaHoraServidor().subscribe({
      next: (fechaHoraRespuesta) => {
        this.fechaServidorHoy = fechaHoraRespuesta.fecha;
        this.fechaHoraServidor = fechaHoraRespuesta.fecha_hora;
        this.fechaHoraTimestamp = fechaHoraRespuesta.timestamp;
        console.log('📅 Fecha del servidor (Perú):', this.fechaServidorHoy);
        console.log('🕐 Hora del servidor (Perú):', fechaHoraRespuesta.hora);
        console.log('📅🕐 Fecha/Hora completa:', this.fechaHoraServidor);
        
        // AHORA cargar las órdenes
        this.cargarOrdenesConFecha();
      },
      error: (error) => {
        console.error('Error obteniendo fecha/hora del servidor:', error);
        // ✅ Usar fecha local pero ajustada a Perú
        const ahora = new Date();
        // Ajustar a UTC-5 (Perú)
        const peruOffset = -5 * 60; // minutos
        const localOffset = ahora.getTimezoneOffset();
        const diffMinutes = peruOffset - localOffset;
        const fechaPeru = new Date(ahora.getTime() + diffMinutes * 60000);
        
        this.fechaServidorHoy = fechaPeru.toISOString().split('T')[0];
        this.fechaHoraServidor = fechaPeru.toISOString();
        this.fechaHoraTimestamp = fechaPeru.getTime();
        console.log('📅 Usando fecha local ajustada a Perú:', this.fechaServidorHoy);
        
        // Cargar órdenes igualmente
        this.cargarOrdenesConFecha();
      }
    })
  );
}

toggleCalendario() {
    this.calendarioVisible = !this.calendarioVisible;
    localStorage.setItem(this.CALENDARIO_VISIBLE_KEY, String(this.calendarioVisible));
  }






// ordenes.component.ts - MODIFICAR cargarOrdenesConFecha

private cargarOrdenesConFecha() {
  this.subscriptions.push(
    this.ordenService.getOrdenes().subscribe({
      next: (data) => {
        this.ordenes = data;
        console.log('📋 Órdenes cargadas:', this.ordenes.length);
        
        // ✅ Guardar en caché para futuros errores
        this.guardarOrdenesEnCache(data);
        
        this.extraerOpcionesFiltros();
        this.filtrarOrdenes();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando órdenes:', error);
        
        // ✅ Intentar recuperar desde caché local
        if (error.status === 503 || error.status === 0) {
          console.warn('⚠️ Backend no disponible, usando datos cacheados');
          const cachedOrders = localStorage.getItem('ordenes_cache');
          if (cachedOrders) {
            this.ordenes = JSON.parse(cachedOrders);
            this.extraerOpcionesFiltros();
            this.filtrarOrdenes();
          } else {
            console.warn('⚠️ No hay datos en caché');
          }
        }
        this.cargando = false;
      }
    })
  );
}

// Guardar órdenes en caché cuando se cargan correctamente
private guardarOrdenesEnCache(ordenes: any[]) {
  localStorage.setItem('ordenes_cache', JSON.stringify(ordenes));
}

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    console.log('🧹 Suscripciones canceladas');
  }

 /**
   * Restaurar filtros desde localStorage
   */
  private restaurarFiltros() {
    try {
      const filtrosGuardados = localStorage.getItem(this.FILTROS_STORAGE_KEY);
      if (filtrosGuardados) {
        const parsed = JSON.parse(filtrosGuardados);
        // Restaurar solo los filtros que existen
        Object.keys(this.filtros).forEach(key => {
          if (parsed[key] !== undefined) {
            (this.filtros as any)[key] = parsed[key];
          }
        });
        console.log('📂 Filtros restaurados:', this.filtros);
      }
      
      // Restaurar estado de visibilidad de filtros avanzados
      const filtrosVisibles = localStorage.getItem(this.FILTROS_VISIBLES_KEY);
      if (filtrosVisibles !== null) {
        this.mostrarFiltrosAvanzados = filtrosVisibles === 'true';
      }
    } catch (error) {
      console.error('Error restaurando filtros:', error);
    }
  }

  /**
   * Guardar filtros en localStorage
   */
private guardarFiltros() {
  try {
    console.log('💾 Guardando filtros - vencidas:', this.filtros.vencidas, 'fechaServidor:', this.fechaServidorHoy);
    localStorage.setItem(this.FILTROS_STORAGE_KEY, JSON.stringify(this.filtros));
    localStorage.setItem(this.FILTROS_VISIBLES_KEY, String(this.mostrarFiltrosAvanzados));
  } catch (error) {
    console.error('Error guardando filtros:', error);
  }
}

// Getter para saber si todas están seleccionadas
get todasSeleccionadas(): boolean {
  return this.ordenesPaginadas.length > 0 && 
         this.ordenesSeleccionadas.length === this.ordenesPaginadas.length;
}

// Getter para saber si algunas están seleccionadas
get algunasSeleccionadas(): boolean {
  return this.ordenesSeleccionadas.length > 0 && 
         this.ordenesSeleccionadas.length < this.ordenesPaginadas.length;
}

// Verificar si una orden está seleccionada
estaSeleccionada(orden: any): boolean {
  return this.ordenesSeleccionadas.some(selected => selected.id === orden.id);
}

// Seleccionar/Deseleccionar una orden
toggleSeleccion(orden: any, event: any) {
  if (event.target.checked) {
    this.ordenesSeleccionadas.push(orden);
  } else {
    this.ordenesSeleccionadas = this.ordenesSeleccionadas.filter(o => o.id !== orden.id);
  }
}

// Seleccionar/Deseleccionar todas las órdenes de la página actual
seleccionarTodas(event: any) {
  if (event.target.checked) {
    // Agregar todas las órdenes de la página actual que no estén ya seleccionadas
    this.ordenesPaginadas.forEach(orden => {
      if (!this.estaSeleccionada(orden)) {
        this.ordenesSeleccionadas.push(orden);
      }
    });
  } else {
    // Remover todas las órdenes de la página actual
    this.ordenesSeleccionadas = this.ordenesSeleccionadas.filter(
      selected => !this.ordenesPaginadas.some(p => p.id === selected.id)
    );
  }
}

// Limpiar todas las selecciones
limpiarSeleccion() {
  this.ordenesSeleccionadas = [];
}

// Eliminar órdenes seleccionadas masivamente
eliminarSeleccionadas() {
  if (this.ordenesSeleccionadas.length === 0) return;
  
  const cantidad = this.ordenesSeleccionadas.length;
  const ordenesTexto = cantidad === 1 ? 'esta orden' : `estas ${cantidad} órdenes`;
  
  Swal.fire({
    title: `¿Eliminar ${cantidad} orden(es)?`,
    html: `
      <div style="text-align: left;">
        <p>¿Está seguro de eliminar ${ordenesTexto}?</p>
        <div style="max-height: 200px; overflow-y: auto; margin-top: 10px; padding: 5px;">
          ${this.ordenesSeleccionadas.map(o => 
            `<div style="padding: 5px; border-bottom: 1px solid #e2e8f0;">
               <strong>${o.id_externo}</strong> - ${o.doctor?.nombre} - ${o.servicio?.nombre}
             </div>`
          ).join('')}
        </div>
        <p class="text-danger" style="margin-top: 10px; color: #f43f5e;">
          <i class="fas fa-exclamation-triangle"></i> Esta acción no se puede deshacer.
        </p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: `Sí, eliminar ${cantidad} orden(es)`,
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#f43f5e'
  }).then((result) => {
    if (result.isConfirmed) {
      const ordenesAEliminar = [...this.ordenesSeleccionadas];
      let eliminadas = 0;
      let errores = 0;
      
      ordenesAEliminar.forEach(orden => {
        this.ordenService.eliminarOrden(orden.id).subscribe({
          next: () => {
            eliminadas++;
            // Eliminar de la lista local
            const index = this.ordenes.findIndex(o => o.id === orden.id);
            if (index !== -1) this.ordenes.splice(index, 1);
            
            // Si ya terminamos todas
            if (eliminadas + errores === ordenesAEliminar.length) {
              this.limpiarSeleccion();
              this.filtrarOrdenes();
              
              Swal.fire({
                icon: 'success',
                title: '¡Eliminadas!',
                html: `Se eliminaron <strong>${eliminadas}</strong> orden(es) correctamente.`,
                timer: 2000,
                showConfirmButton: false
              });
            }
          },
          error: (error) => {
            errores++;
            console.error(`Error eliminando orden ${orden.id_externo}:`, error);
            
            if (eliminadas + errores === ordenesAEliminar.length) {
              this.limpiarSeleccion();
              this.filtrarOrdenes();
              
              if (errores > 0) {
                Swal.fire({
                  icon: 'warning',
                  title: 'Eliminación parcial',
                  html: `Se eliminaron <strong>${eliminadas}</strong> orden(es), pero <strong>${errores}</strong> no pudieron ser eliminadas.`,
                  timer: 3000,
                  showConfirmButton: true
                });
              }
            }
          }
        });
      });
    }
  });
}

// Modificar extraerOpcionesFiltros
extraerOpcionesFiltros() {
  // Para filtros necesitamos objetos completos, no solo strings
  this.doctoresCompleto = this.ordenes
    .map(o => o.doctor)
    .filter((doctor, index, self) => 
      doctor && self.findIndex(d => d?.id === doctor?.id) === index
    );

  this.serviciosCompleto = this.ordenes
    .map(o => o.servicio)
    .filter((servicio, index, self) => 
      servicio && self.findIndex(s => s?.id === servicio?.id) === index
    );

  // Para compatibilidad con código existente
  this.doctoresUnicos = this.doctoresCompleto.map(d => d.nombre);
  this.serviciosUnicos = this.serviciosCompleto.map(s => s.nombre);
}

// Métodos para manejar selección
onDoctorSeleccionado(doctor: any) {
  this.filtros.doctor = doctor ? doctor.nombre : '';
  this.filtrarOrdenes();
   this.guardarFiltros();
}

onServicioSeleccionado(servicio: any) {
  this.filtros.servicio = servicio ? servicio.nombre : '';
  this.filtrarOrdenes();
   this.guardarFiltros();
}


// Modifica el método filtrarOrdenes
filtrarOrdenes() {
  this.ordenesFiltradas = this.ordenes.filter(orden => {
    // Búsqueda global
    if (this.filtros.busquedaGlobal) {
      const busqueda = this.filtros.busquedaGlobal.toLowerCase();
      const doctorNombre = orden.doctor?.nombre?.toLowerCase() || '';
      const servicioNombre = orden.servicio?.nombre?.toLowerCase() || '';
      const clienteNombre = (orden.cliente_nombre || '').toLowerCase();
      const idExterno = (orden.id_externo || '').toLowerCase();
      const coincideGlobal = 
        doctorNombre.includes(busqueda) ||
        servicioNombre.includes(busqueda) ||
        clienteNombre.includes(busqueda) ||
        idExterno.includes(busqueda);
      
      if (!coincideGlobal) return false;
    }

    // FILTRO POR ESTADO (desde los botones Pendientes/Terminados)
    if (this.filtros.estado) {
      if (orden.estado !== this.filtros.estado) return false;
      
      // Si el filtro es "pendiente", además NO deben estar vencidas
      if (this.filtros.estado === 'pendiente') {
        const saldo = this.calcularSaldo(orden);
        const esVencida = this.isVencida(orden);
        // Solo mostrar pendientes que NO están vencidas
        if (esVencida) return false;
        if (saldo <= 0) return false;
      }
    }
    
  // FILTRO POR VENCIDAS (desde el botón Vencidas)
    if (this.filtros.vencidas) {
      const saldo = this.calcularSaldo(orden);
      // Solo órdenes pendientes, con saldo > 0, y que estén vencidas
      if (orden.estado !== 'pendiente') return false;
      if (saldo <= 0) return false;
      if (!this.isVencida(orden)) return false; // Al menos un servicio vencido
    }
    
    // Filtro para ocultar órdenes pagadas/terminadas (cuando no hay filtros activos)
    if (this.filtros.ocultarTerminadas && !this.filtros.estado && !this.filtros.vencidas) {
      const saldo = this.calcularSaldo(orden);
      const estaTerminada = orden.estado === 'terminado';
      const saldoCero = saldo === 0;
      if (estaTerminada || saldoCero) return false;
    }

    return true;
  });
  
  this.guardarFiltros();
  this.actualizarPaginacion();
}
  // Método para limpiar todos los filtros
limpiarFiltros() {
  this.filtros = {
    busquedaGlobal: '',
    doctor: '',
    servicio: '',
    estado: '',
    prioridad: '',
    cliente: '',
    fechaInicio: '',
    fechaFin: '',
    saldoMin: null,
    saldoMax: null,
    vencidas: false,
    ocultarTerminadas: true  // <-- AGREGAR ESTA LÍNEA
  };
  this.filtrarOrdenes();
  this.guardarFiltros();
}

 // MODIFICAR el método filtrosActivosCount - AGREGAR el conteo
get filtrosActivosCount(): number {
  let count = 0;
  if (this.filtros.doctor) count++;
  if (this.filtros.servicio) count++;
  if (this.filtros.estado) count++;
  if (this.filtros.prioridad) count++;
  if (this.filtros.cliente) count++;
  if (this.filtros.fechaInicio || this.filtros.fechaFin) count++;
  if (this.filtros.saldoMin !== null || this.filtros.saldoMax !== null) count++;
  if (this.filtros.vencidas) count++;
  if (!this.filtros.ocultarTerminadas) count++; // <-- AGREGAR ESTA LÍNEA
  return count;
}



  cargarOrdenes() {
    this.cargando = true;
    this.ordenService.getOrdenes().subscribe({
      next: (data) => {
        this.ordenes = data;
        this.filtrarOrdenes();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando órdenes:', error);
        this.cargando = false;
      }
    });
  }



  calcularTotalPagado(orden: any): number {
  return Number(orden.pagos?.reduce((sum: number, pago: any) => sum + Number(pago.monto), 0)) || 0;
}

 calcularSaldo(orden: any): number {
  return Number(Number(orden.total) - this.calcularTotalPagado(orden)) || 0;
}

// ordenes.component.ts - Verificar isVencida

// ordenes.component.ts - Reemplazar el método isVencida

// ordenes.component.ts - Reemplazar isVencida

// ordenes.component.ts - MODIFICAR isVencida()

/**
 * Verifica si una orden está vencida
 * Una orden está vencida si AL MENOS UNO de sus servicios tiene fecha límite pasada
 */
isVencida(orden: any): boolean {
  if (orden.estado === 'terminado') return false;
  const saldo = this.calcularSaldo(orden);
  if (saldo <= 0) return false;
  
  // ✅ Si no tiene detalles, usar fecha_limite de la orden (legacy)
  if (!orden.detalles || orden.detalles.length === 0) {
    if (!orden.fecha_limite) return false;
    return this.isFechaVencida(orden.fecha_limite, orden.hora_limite);
  }
  
  // ✅ Verificar cada detalle (servicio)
  for (const detalle of orden.detalles) {
    if (detalle.fecha_limite) {
      if (this.isFechaVencida(detalle.fecha_limite, detalle.hora_limite)) {
        return true; // Al menos un servicio está vencido
      }
    }
  }
  
  return false; // Ningún servicio está vencido
}

/**
 * Método auxiliar para verificar si una fecha/hora está vencida
 */
private isFechaVencida(fecha: string, hora?: string): boolean {
  if (!fecha) return false;
  
  let ahora: Date;
  if (this.fechaHoraTimestamp > 0) {
    ahora = new Date(this.fechaHoraTimestamp);
  } else {
    ahora = new Date();
  }
  
  const [year, month, day] = fecha.split('-').map(Number);
  let horas = 23, minutos = 59, segundos = 59;
  
  if (hora) {
    const parts = hora.split(':');
    horas = parseInt(parts[0]);
    minutos = parseInt(parts[1]);
    segundos = 0;
  }
  
  const fechaLimite = new Date(year, month - 1, day, horas, minutos, segundos);
  return ahora.getTime() > fechaLimite.getTime();
}

/**
 * Verifica si TODOS los servicios de una orden están vencidos
 * (Para mostrar en la vista de vencidas, una orden con al menos un servicio vencido ya cuenta)
 */
isCompletamenteVencida(orden: any): boolean {
  if (orden.estado === 'terminado') return false;
  if (!orden.detalles || orden.detalles.length === 0) {
    return this.isVencida(orden);
  }
  
  for (const detalle of orden.detalles) {
    if (detalle.fecha_limite) {
      if (!this.isFechaVencida(detalle.fecha_limite, detalle.hora_limite)) {
        return false; // Un servicio no está vencido, la orden no está completamente vencida
      }
    }
  }
  return true; // Todos los servicios están vencidos
}
  // Método para agregar pago
agregarPago(orden: any) {
  // Calcular el saldo actual de esta orden
  const totalPagado = this.calcularTotalPagado(orden);
  const saldo = Number(orden.total) - totalPagado;
  
  // Si el saldo ya es 0, no permitir agregar más pagos
  if (saldo <= 0) {
    Swal.fire({
      icon: 'info',
      title: 'Saldo cancelado',
      text: 'Esta orden ya tiene el saldo completamente pagado',
      timer: 2000,
      showConfirmButton: false
    });
    return;
  }
  
  Swal.fire({
    title: 'Registrar Pago',
    html: `
      <input type="number" id="monto" class="swal2-input" 
             placeholder="Monto (S/)" step="0.01" min="0.01" 
             max="${saldo}" value="${saldo.toFixed(2)}">
      <select id="metodo" class="swal2-select" style="width: 100%; margin-bottom: 10px;">
        <option value="efectivo">Efectivo</option>
        <option value="tarjeta">Tarjeta</option>
        <option value="transferencia">Transferencia</option>
        <option value="yape">Yape</option>
        <option value="plin">Plin</option>
      </select>
      <input type="text" id="referencia" class="swal2-input" placeholder="Referencia (opcional)">
      <div class="swal2-text" style="font-size:0.9rem; color:#64748b; margin-top:10px;">
        Saldo pendiente: ${this.monedaPipe.transform(saldo)}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Registrar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const monto = (document.getElementById('monto') as HTMLInputElement).value;
      const metodo = (document.getElementById('metodo') as HTMLSelectElement).value;
      const referencia = (document.getElementById('referencia') as HTMLInputElement).value;
      
      if (!monto || monto.trim() === '') {
        Swal.showValidationMessage('Ingrese un monto');
        return false;
      }
      
      const montoNumerico = parseFloat(monto);
      
      if (isNaN(montoNumerico) || montoNumerico <= 0) {
        Swal.showValidationMessage('Ingrese un monto válido mayor a 0');
        return false;
      }
      
      if (montoNumerico > saldo) {
        Swal.showValidationMessage(`El monto no puede exceder el saldo pendiente (${this.monedaPipe.transform(saldo)})`);
        return false;
      }
      
      return { monto: montoNumerico, metodo, referencia };
    }
  }).then((result) => {
    if (result.isConfirmed) {
      this.pagoService.registrarPago({
        orden_id: orden.id,
        monto: result.value.monto,
        metodo_pago: result.value.metodo,
        referencia: result.value.referencia
      }).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'Pago registrado correctamente',
            timer: 1500,
            showConfirmButton: false
          });
          this.cargarOrdenes(); // Recargar la lista
        },
        error: (error) => {
          console.error('Error registrando pago:', error);
          if (error.error && error.error.error) {
            Swal.fire('Error', error.error.error, 'error');
          } else {
            Swal.fire('Error', 'No se pudo registrar el pago', 'error');
          }
        }
      });
    }
  });
}
// Reemplazar el método enviarWhatsApp
enviarWhatsApp(orden: any) {
  this.whatsAppService.enviarMensajePersonalizado({
    telefono: orden.doctor?.telefono_whatsapp,
    nombre: orden.doctor?.nombre,
    tipo: 'orden',
    datos: orden
  });
}


// Modificar el método eliminarOrden existente para que no interfiera con la selección
eliminarOrden(orden: any, event?: Event) {
  if (event) {
    event.stopPropagation();
  }
  
  Swal.fire({
    title: '¿Eliminar orden?',
    text: `¿Está seguro de eliminar la orden #${orden.id_externo}? Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#f43f5e'
  }).then((result) => {
    if (result.isConfirmed) {
      this.subscriptions.push(
        this.ordenService.eliminarOrden(orden.id).subscribe({
          next: () => {
            // Eliminar de la lista local
            const index = this.ordenes.findIndex(o => o.id === orden.id);
            if (index !== -1) this.ordenes.splice(index, 1);
            
            // Si estaba seleccionada, quitarla de selección
            if (this.estaSeleccionada(orden)) {
              this.ordenesSeleccionadas = this.ordenesSeleccionadas.filter(o => o.id !== orden.id);
            }
            
            this.filtrarOrdenes();
            
            Swal.fire({
              icon: 'success',
              title: '¡Eliminada!',
              text: `La orden #${orden.id_externo} ha sido eliminada`,
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error eliminando orden:', error);
            Swal.fire('Error', 'No se pudo eliminar la orden', 'error');
          }
        })
      );
    }
  });
}

// Agregar este método auxiliar para formatear hora (si no existe en el componente)
private formatearHora(hora: string): string {
  if (!hora) return '';
  const match = hora.match(/^(\d{2}):(\d{2})/);
  if (match) {
    const horas = parseInt(match[1]);
    const minutos = match[2];
    const ampm = horas >= 12 ? 'PM' : 'AM';
    const horas12 = horas % 12 || 12;
    return `${horas12}:${minutos} ${ampm}`;
  }
  return hora;
}



/**
 * Descargar PDF
 */
private descargarPDF(orden: any, pdfBlob: Blob) {
  const nombreArchivo = `ticket_${orden.id_externo}.pdf`;
  saveAs(pdfBlob, nombreArchivo);
  
  Swal.fire({
    title: 'PDF descargado',
    text: `El archivo ${nombreArchivo} se ha descargado correctamente.`,
    icon: 'success',
    timer: 2000,
    showConfirmButton: false
  });
}

// Reemplaza el método setFiltroEstado
// Reemplaza el método setFiltroEstado
setFiltroEstado(estado: string) {
  // Desactivar filtro de vencidas si está activo
  if (this.filtros.vencidas) {
    this.filtros.vencidas = false;
  }
  
  this.filtros.estado = estado;
  this.paginaActual = 1;
  
  // Configurar ocultarTerminadas según el estado seleccionado
  if (estado === 'terminado') {
    this.filtros.ocultarTerminadas = false;
  } else {
    this.filtros.ocultarTerminadas = true;
  }
  
  this.filtrarOrdenes();
}

// Reemplaza el método toggleFiltroVencidas
toggleFiltroVencidas() {
  // Si estamos filtrando por estado, lo desactivamos
  if (this.filtros.estado) {
    this.filtros.estado = '';
  }
  
  this.filtros.vencidas = !this.filtros.vencidas;
  this.paginaActual = 1;
  
  // Siempre ocultar terminadas cuando vemos vencidas
  this.filtros.ocultarTerminadas = true;
  
  this.filtrarOrdenes();
}

toggleOcultarTerminadas() {
  this.filtros.ocultarTerminadas = !this.filtros.ocultarTerminadas;
  this.paginaActual = 1; // <-- AGREGAR ESTA LÍNEA
  this.filtrarOrdenes();
}
// AGREGAR ESTE MÉTODO para actualizar la paginación
actualizarPaginacion() {
  this.totalPaginas = Math.ceil(this.ordenesFiltradas.length / this.itemsPorPagina);
  
  // Asegurar que la página actual no exceda el total
  if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) {
    this.paginaActual = this.totalPaginas;
  } else if (this.totalPaginas === 0) {
    this.paginaActual = 1;
  }
  
  const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
  const fin = inicio + this.itemsPorPagina;
  this.ordenesPaginadas = this.ordenesFiltradas.slice(inicio, fin);
}
// AGREGAR ESTOS MÉTODOS para controlar la paginación
cambiarPagina(pagina: number) {
  if (pagina >= 1 && pagina <= this.totalPaginas) {
    this.paginaActual = pagina;
    this.actualizarPaginacion();
  }
}

anteriorPagina() {
  if (this.paginaActual > 1) {
    this.paginaActual--;
    this.actualizarPaginacion();
  }
}

siguientePagina() {
  if (this.paginaActual < this.totalPaginas) {
    this.paginaActual++;
    this.actualizarPaginacion();
  }
}

cambiarItemsPorPagina(cantidad: string | number) {
  this.itemsPorPagina = typeof cantidad === 'string' ? parseInt(cantidad, 10) : cantidad;
  this.paginaActual = 1;
  this.actualizarPaginacion();
}
getContadorPorEstado(estado: string, vencidas: boolean = false): number {
  if (vencidas) {
    return this.ordenes.filter(o => 
      o.estado === 'pendiente' && 
      this.isVencida(o) && 
      this.calcularSaldo(o) > 0
    ).length;
  }
  return this.ordenes.filter(o => o.estado === estado).length;
}

// Agrega estos métodos para los contadores

getContadorPendientesNoVencidas(): number {
  return this.ordenes.filter(o => 
    o.estado === 'pendiente' && 
    !this.isVencida(o) && 
    this.calcularSaldo(o) > 0
  ).length;
}

// ordenes.component.ts - REEMPLAZAR getContadorVencidas

getContadorVencidas(): number {
    return this.ordenes.filter(o => {
        if (o.estado !== 'pendiente') return false;
        if (this.calcularSaldo(o) <= 0) return false;
        
        // ✅ Verificar si al menos un servicio está vencido
        if (!o.detalles || o.detalles.length === 0) return false;
        
        for (const detalle of o.detalles) {
            if (detalle.fecha_limite) {
                if (this.isFechaVencida(detalle.fecha_limite, detalle.hora_limite)) {
                    return true;
                }
            }
        }
        return false;
    }).length;
}

getContadorTerminados(): number {
  return this.ordenes.filter(o => o.estado === 'terminado').length;
}

// ordenes.component.ts - AGREGAR ESTE MÉTODO

// ordenes.component.ts - Modificar aplicarFiltrosDesdeCalendario

aplicarFiltrosDesdeCalendario(filtros: any) {
  // ✅ Aplicar filtros desde el calendario a la tabla
  if (filtros.fecha_inicio && filtros.fecha_fin) {
    this.filtros.fechaInicio = filtros.fecha_inicio;
    this.filtros.fechaFin = filtros.fecha_fin;
  }
  
  if (filtros.doctor_id) {
    const doctor = this.doctoresCompleto.find(d => d.id == filtros.doctor_id);
    if (doctor) {
      this.filtros.doctor = doctor.nombre;
    } else {
      this.filtros.doctor = '';
    }
  }
  
  if (filtros.estado && filtros.estado !== 'todos') {
    this.setFiltroEstado(filtros.estado);
  }
  
  // ✅ Aplicar los filtros
  this.filtrarOrdenes();
  
  // Scroll suave hacia la tabla
  setTimeout(() => {
    document.querySelector('.table-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}
}