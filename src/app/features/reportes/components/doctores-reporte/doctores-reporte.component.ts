// doctores-reporte.component.ts - VERSIÓN COMPLETA CON MEJORAS

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ReporteService } from '../../../../core/services/reporte.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import Swal from 'sweetalert2';
import { ImagenPipe } from '../../../../shared/pipes/imagen.pipe';

@Component({
  selector: 'app-doctores-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MonedaPipe, FechaPipe, LoadingSpinnerComponent, ImagenPipe],
  templateUrl: './doctores-reporte.component.html',
  styleUrls: ['./doctores-reporte.component.css']
})
export class DoctoresReporteComponent implements OnInit, OnDestroy {
  doctores: any[] = [];
  doctoresFiltrados: any[] = [];
  doctoresPaginados: any[] = [];
  cargando = true;
  
  totalDoctores = 0;
  deudaTotal = 0;
  totalPendientes = 0;
  totalFacturado = 0;
  totalPagado = 0;
  
  topDoctores: any[] = [];
  topDeudores: any[] = [];
  
  paginaActual: number = 1;
  itemsPerPage: number = 10;
  
  filtroNombre: string = '';
  filtroDeuda: string = 'todos';
  filtroTipoCliente: string = 'todos';
  filtroMes: string = '';
  
  // Filtro por paciente
  filtroPaciente: string = '';
  
  // Modal de detalle de pagos por paciente
  modalPacienteVisible: boolean = false;
  modalPacienteData: any = null;
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private reporteService: ReporteService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargando = true;
    
    const params: any = {};
    if (this.filtroTipoCliente !== 'todos') {
      params.tipo_cliente = this.filtroTipoCliente;
    }
    if (this.filtroMes) {
      params.mes = this.filtroMes;
    }
    
    console.log('🔍 Enviando filtros al backend:', params);
    
    this.subscriptions.push(
      this.reporteService.getReporteDoctores(params).subscribe({
        next: (data) => {
          this.doctores = data.doctores;
          
          this.totalDoctores = data.doctores.length;
          this.totalFacturado = data.doctores.reduce((sum: number, d: any) => sum + (d.total_facturado || 0), 0);
          this.totalPagado = data.doctores.reduce((sum: number, d: any) => sum + (d.total_pagado || 0), 0);
          this.deudaTotal = data.doctores.reduce((sum: number, d: any) => sum + (d.deuda_total || 0), 0);
          this.totalPendientes = data.doctores.reduce((sum: number, d: any) => sum + (d.ordenes_pendientes || 0), 0);
          
          this.topDoctores = [...data.doctores]
            .sort((a, b) => b.total_ordenes - a.total_ordenes)
            .slice(0, 5);
          
          this.topDeudores = [...data.doctores]
            .sort((a, b) => b.deuda_total - a.deuda_total)
            .slice(0, 5);
          
          this.aplicarFiltrosFrontend();
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error cargando reporte:', error);
          this.cargando = false;
          Swal.fire('Error', 'No se pudo cargar el reporte', 'error');
        }
      })
    );
  }

  // ✅ MODIFICADO: Incluye filtro por paciente y número de orden
// doctores-reporte.component.ts - MODIFICAR aplicarFiltrosFrontend

aplicarFiltrosFrontend() {
    let filtrados = [...this.doctores];
    
    // ✅ Si el término de búsqueda parece un número de orden (empieza con ORD-)
    if (this.filtroNombre.trim()) {
        const termino = this.filtroNombre.toLowerCase().trim();
        
        // ✅ Buscar por número de orden en el filtro de doctor
        if (termino.startsWith('ord-')) {
            filtrados = filtrados.filter(d => {
                if (d.ordenes && d.ordenes.length > 0) {
                    return d.ordenes.some((orden: any) => 
                        orden.id_externo?.toLowerCase() === termino
                    );
                }
                return false;
            });
        } else {
            // Búsqueda normal por nombre de doctor
            filtrados = filtrados.filter(d => d.doctor.toLowerCase().includes(termino));
        }
    }
    
    // ✅ Buscar por paciente (nombre o código)
    if (this.filtroPaciente.trim()) {
        const termino = this.filtroPaciente.toLowerCase().trim();
        
        // ✅ Si es un número de orden, buscar en órdenes
        if (termino.startsWith('ord-')) {
            filtrados = filtrados.filter(d => {
                if (d.ordenes && d.ordenes.length > 0) {
                    return d.ordenes.some((orden: any) => 
                        orden.id_externo?.toLowerCase() === termino
                    );
                }
                return false;
            });
        } else {
            // Búsqueda normal por paciente
            filtrados = filtrados.filter(d => {
                if (d.ordenes && d.ordenes.length > 0) {
                    return d.ordenes.some((orden: any) => {
                        const clienteOrden = orden.cliente_nombre?.toLowerCase() || '';
                        const codigoOrden = orden.cliente_codigo?.toLowerCase() || '';
                        const detalles = orden.detalles || [];
                        const coincideDetalle = detalles.some((det: any) => {
                            const nombreDet = det.cliente_nombre?.toLowerCase() || '';
                            const codigoDet = det.cliente_codigo?.toLowerCase() || '';
                            return nombreDet.includes(termino) || codigoDet.includes(termino);
                        });
                        return clienteOrden.includes(termino) || codigoOrden.includes(termino) || coincideDetalle;
                    });
                }
                return false;
            });
        }
    }
    
    if (this.filtroDeuda === 'conDeuda') {
        filtrados = filtrados.filter(d => d.deuda_total > 0);
    } else if (this.filtroDeuda === 'sinDeuda') {
        filtrados = filtrados.filter(d => d.deuda_total === 0);
    }
    
    this.doctoresFiltrados = filtrados;
    this.paginaActual = 1;
    this.actualizarPaginacion();
}
  aplicarFiltros() {
    this.cargarDatos();
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroDeuda = 'todos';
    this.filtroTipoCliente = 'todos';
    this.filtroMes = '';
    this.filtroPaciente = '';
    this.cargarDatos();
  }

  actualizarPaginacion() {
    const pagina = Number(this.paginaActual);
    const items = Number(this.itemsPerPage);
    
    const inicio = (pagina - 1) * items;
    const fin = inicio + items;
    const finReal = Math.min(fin, this.doctoresFiltrados.length);
    
    this.doctoresPaginados = [...this.doctoresFiltrados.slice(inicio, finReal)];
    this.cdr.detectChanges();
  }

  cambiarPagina(pagina: number) {
    const totalPaginas = Math.ceil(this.doctoresFiltrados.length / Number(this.itemsPerPage));
    if (pagina !== this.paginaActual && pagina >= 1 && pagina <= totalPaginas) {
      this.paginaActual = pagina;
      this.actualizarPaginacion();
    }
  }

  cambiarItemsPorPagina() {
    this.itemsPerPage = Number(this.itemsPerPage);
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  get totalPaginas(): number {
    return Math.ceil(this.doctoresFiltrados.length / Number(this.itemsPerPage));
  }

  get inicioMostrando(): number {
    if (this.doctoresFiltrados.length === 0) return 0;
    return (this.paginaActual - 1) * Number(this.itemsPerPage) + 1;
  }

  get finMostrando(): number {
    return Math.min(this.paginaActual * Number(this.itemsPerPage), this.doctoresFiltrados.length);
  }

  get paginationPages(): (number | string)[] {
    const total = this.totalPaginas;
    const current = this.paginaActual;
    const pages: (number | string)[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  }

  // ✅ Abrir modal de detalle de pagos por paciente
abrirDetallePaciente(doctor: any, paciente: string) {
  const ordenesPaciente = doctor.ordenes?.filter((orden: any) => {
    const cliente = orden.cliente_nombre?.toLowerCase() || '';
    const detalles = orden.detalles || [];
    return cliente.includes(paciente.toLowerCase()) || 
           detalles.some((det: any) => (det.cliente_nombre?.toLowerCase() || '').includes(paciente.toLowerCase()));
  }) || [];
  
  let totalFacturado = 0;
  let totalPagado = 0;
  let pagos: any[] = [];
  
  const ordenesConDoctor = ordenesPaciente.map((orden: any) => ({
    ...orden,
    doctorNombre: doctor.doctor,  // ✅ Agregar doctor
    detallesConNombres: orden.detalles?.map((det: any) => ({
      id: det.id,
      nombre: det.servicio?.nombre || det.servicio_nombre || 'Sin nombre',
      precio: parseFloat(det.precio_unitario) || 0,
      cantidad: det.cantidad || 1,
      cliente: det.cliente_nombre || null,
      cliente_codigo: det.cliente_codigo || null
    })) || []
  }));
  
  ordenesPaciente.forEach((orden: any) => {
    orden.detalles?.forEach((det: any) => {
      totalFacturado += parseFloat(det.precio_unitario) || 0;
    });
    if (orden.pagos) {
      orden.pagos.forEach((p: any) => {
        totalPagado += parseFloat(p.monto) || 0;
        pagos.push({
          orden: orden.id_externo,
          servicio: orden.detalles?.map((d: any) => d.servicio?.nombre).join(', ') || 'N/A',
          monto: p.monto,
          metodo: p.metodo_pago,
          fecha: p.creado_en,
          referencia: p.referencia || '-'
        });
      });
    }
  });
  
  this.modalPacienteData = {
    doctor: doctor.doctor,
    paciente: paciente,
    ordenes: ordenesConDoctor,
    totalFacturado: totalFacturado,
    totalPagado: totalPagado,
    saldo: totalFacturado - totalPagado,
    pagos: pagos
  };
  
  this.modalPacienteVisible = true;
}

  cerrarModalPaciente() {
    this.modalPacienteVisible = false;
    this.modalPacienteData = null;
  }

  exportarExcel() {
    this.subscriptions.push(
      this.reporteService.exportarExcel('doctores').subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `reporte_doctores_${new Date().toISOString().split('T')[0]}.xlsx`;
          link.click();
          window.URL.revokeObjectURL(url);
          Swal.fire('Éxito', 'Reporte exportado correctamente', 'success');
        },
        error: (error) => {
          console.error('Error exportando:', error);
          Swal.fire('Error', 'No se pudo exportar el reporte', 'error');
        }
      })
    );
  }

// doctores-reporte.component.ts - MODIFICAR exportarDoctor

// doctores-reporte.component.ts - MODIFICAR exportarDoctor

exportarDoctor(doctorId: number, doctorNombre: string) {
    // ✅ Obtener el paciente filtrado actual
    let pacienteFiltrado = this.filtroPaciente.trim() || undefined;
    
    // ✅ Si el filtro de doctor contiene un número de orden, usarlo como filtro
    if (this.filtroNombre.trim()) {
        const termino = this.filtroNombre.trim();
        // Si empieza con ORD- es un número de orden
        if (termino.toUpperCase().startsWith('ORD-')) {
            // ✅ Si no hay paciente filtrado, usar el número de orden como filtro
            if (!pacienteFiltrado) {
                pacienteFiltrado = termino;
            }
        }
    }
    
    console.log('📤 Exportando reporte con filtro:', { 
        doctorId, 
        doctorNombre, 
        pacienteFiltrado,
        filtroNombre: this.filtroNombre,
        filtroPaciente: this.filtroPaciente
    });
    
    this.reporteService.exportarReportePorDoctor(doctorId, pacienteFiltrado).subscribe({
        next: (blob) => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            let filename = `reporte_doctor_${doctorNombre.replace(/\s/g, '_')}`;
            if (pacienteFiltrado) {
                filename += `_${pacienteFiltrado.replace(/\s/g, '_')}`;
            }
            filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
            
            const mensaje = pacienteFiltrado 
                ? `Reporte de ${doctorNombre} para "${pacienteFiltrado}" exportado correctamente`
                : `Reporte de ${doctorNombre} exportado correctamente`;
            Swal.fire('Éxito', mensaje, 'success');
        },
        error: (error) => {
            console.error('Error exportando reporte del doctor:', error);
            Swal.fire('Error', 'No se pudo exportar el reporte del doctor', 'error');
        }
    });
}

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    console.log('🧹 DoctoresReporteComponent destruido');
  }

  /**
   * ✅ Obtiene las órdenes filtradas por paciente
   */
  getOrdenesFiltradas(): any[] {
    if (!this.filtroPaciente.trim()) return [];
    
    const termino = this.filtroPaciente.toLowerCase().trim();
    const ordenesEncontradas: any[] = [];
    
    this.doctores.forEach(d => {
      if (d.ordenes && d.ordenes.length > 0) {
        d.ordenes.forEach((orden: any) => {
          const clienteOrden = orden.cliente_nombre?.toLowerCase() || '';
          const codigoOrden = orden.cliente_codigo?.toLowerCase() || '';
          const detalles = orden.detalles || [];
          const coincide = clienteOrden.includes(termino) || codigoOrden.includes(termino) ||
            detalles.some((det: any) => {
              const nombreDet = det.cliente_nombre?.toLowerCase() || '';
              const codigoDet = det.cliente_codigo?.toLowerCase() || '';
              return nombreDet.includes(termino) || codigoDet.includes(termino);
            });
          
          if (coincide) {
            ordenesEncontradas.push({
              ...orden,
              doctor: d.doctor,
              doctorId: d.doctorId
            });
          }
        });
      }
    });
    
    return ordenesEncontradas;
  }

  /**
   * ✅ Abre el modal con los detalles del paciente desde la búsqueda
   * ✅ AHORA FUNCIONA PARA CLIENTE ÚNICO, CLIENTES DIFERENTES Y NÚMEROS DE ORDEN
   */
  abrirModalPacienteDesdeBusqueda() {
    const termino = this.filtroPaciente.trim();
    if (!termino) return;
    
    const terminoLower = termino.toLowerCase();
    
    // ✅ PRIMERO: Verificar si es un número de orden
    if (terminoLower.startsWith('ord-')) {
      // Buscar la orden específica en todos los doctores
      for (const d of this.doctores) {
        if (d.ordenes) {
          const orden = d.ordenes.find((o: any) => 
            o.id_externo?.toLowerCase() === terminoLower
          );
          if (orden) {
            const totalPagado = orden.pagos?.reduce((sum: number, p: any) => sum + Number(p.monto), 0) || 0;
            
            // ✅ Obtener servicios con nombres
            const detallesConNombres = orden.detalles?.map((det: any) => ({
              id: det.id,
              nombre: det.servicio?.nombre || det.servicio_nombre || 'Sin nombre',
              precio: parseFloat(det.precio_unitario) || 0,
              cantidad: det.cantidad || 1,
              cliente: det.cliente_nombre || null,
              cliente_codigo: det.cliente_codigo || null
            })) || [];
            
            // ✅ Obtener pagos con servicios asociados
            const pagosConDetalle = orden.pagos?.map((p: any) => {
              let servicioNombre = 'N/A';
              try {
                if (p.observaciones) {
                  const obs = typeof p.observaciones === 'string' ? JSON.parse(p.observaciones) : p.observaciones;
                  if (obs.servicio) {
                    servicioNombre = obs.servicio;
                  } else if (obs.detalle_id) {
                    const det = detallesConNombres.find((d: any) => d.id === obs.detalle_id);
                    if (det) servicioNombre = det.nombre;
                  }
                }
              } catch {}
              return {
                orden: orden.id_externo,
                servicio: servicioNombre,
                monto: p.monto,
                metodo: p.metodo_pago,
                fecha: p.creado_en,
                referencia: p.referencia || '-'
              };
            }) || [];
            
            this.modalPacienteData = {
              doctor: d.doctor,
              paciente: `Orden ${orden.id_externo}`,
              ordenes: [{
                ...orden,
                detallesConNombres: detallesConNombres
              }],
              totalFacturado: orden.total || 0,
              totalPagado: totalPagado,
              saldo: (orden.total || 0) - totalPagado,
              pagos: pagosConDetalle
            };
            this.modalPacienteVisible = true;
            return;
          }
        }
      }
      
      Swal.fire('Info', `No se encontró la orden "${termino}"`, 'info');
      return;
    }
    
     // ✅ Si no es número de orden, buscar por nombre/código
  let ordenesEncontradas: any[] = [];
  let totalFacturado = 0;
  let totalPagado = 0;
  let pagos: any[] = [];
  let doctorEncontrado = '';
  let nombrePaciente = termino;
  
  this.doctores.forEach(d => {
    if (d.ordenes && d.ordenes.length > 0) {
      d.ordenes.forEach((orden: any) => {
        const detalles = orden.detalles || [];
        
        // ✅ Filtrar detalles que coinciden con el cliente
        const detallesFiltrados = detalles.filter((det: any) => {
          const nombreDet = det.cliente_nombre?.toLowerCase() || '';
          const codigoDet = det.cliente_codigo?.toLowerCase() || '';
          return nombreDet === terminoLower || codigoDet === terminoLower ||
                 nombreDet.includes(terminoLower) || codigoDet.includes(terminoLower);
        });
        
        // ✅ Si la orden tiene cliente_nombre global, verificar también
        const clienteOrden = orden.cliente_nombre?.toLowerCase() || '';
        const codigoOrden = orden.cliente_codigo?.toLowerCase() || '';
        const coincideGlobal = clienteOrden === terminoLower || codigoOrden === terminoLower ||
                               clienteOrden.includes(terminoLower) || codigoOrden.includes(terminoLower);
        
        let detallesFinales: any[] = [];
        if (coincideGlobal && detallesFiltrados.length === 0) {
          detallesFinales = detalles.map((det: any) => ({
            id: det.id,
            nombre: det.servicio?.nombre || det.servicio_nombre || 'Sin nombre',
            precio: parseFloat(det.precio_unitario) || 0,
            cantidad: det.cantidad || 1,
            cliente: det.cliente_nombre || null,
            cliente_codigo: det.cliente_codigo || null
          }));
        } else if (detallesFiltrados.length > 0) {
          detallesFinales = detallesFiltrados.map((det: any) => ({
            id: det.id,
            nombre: det.servicio?.nombre || det.servicio_nombre || 'Sin nombre',
            precio: parseFloat(det.precio_unitario) || 0,
            cantidad: det.cantidad || 1,
            cliente: det.cliente_nombre || null,
            cliente_codigo: det.cliente_codigo || null
          }));
        }
        
        if (detallesFinales.length === 0) return;
        
        // ✅ Determinar el nombre del paciente
        let paciente = termino;
        const detEncontrado = detalles.find((det: any) => {
          const nombreDet = det.cliente_nombre?.toLowerCase() || '';
          const codigoDet = det.cliente_codigo?.toLowerCase() || '';
          return nombreDet === terminoLower || codigoDet === terminoLower ||
                 nombreDet.includes(terminoLower) || codigoDet.includes(terminoLower);
        });
        
        if (detEncontrado) {
          paciente = detEncontrado.cliente_nombre || termino;
        } else if (orden.cliente_nombre) {
          paciente = orden.cliente_nombre;
        }
        
        // ✅ AGREGAR EL NOMBRE DEL DOCTOR A LA ORDEN
        ordenesEncontradas.push({
          ...orden,
          doctorNombre: d.doctor,  // <-- Nombre del doctor
          doctorId: d.doctorId,
          paciente: paciente,
          detallesConNombres: detallesFinales
        });
        
        if (!doctorEncontrado) doctorEncontrado = d.doctor;
        nombrePaciente = paciente;
        
        // ✅ Calcular totales SOLO para los detalles filtrados
        detallesFinales.forEach((det: any) => {
          totalFacturado += det.precio || 0;
        });
        
        // ✅ Calcular pagos SOLO para los detalles filtrados
        if (orden.pagos) {
          const detallesIds = detallesFinales.map((d: any) => d.id);
          orden.pagos.forEach((p: any) => {
            let servicioNombre = 'N/A';
            let coincidePago = false;
            try {
              if (p.observaciones) {
                const obs = typeof p.observaciones === 'string' ? JSON.parse(p.observaciones) : p.observaciones;
                if (obs.detalle_id && detallesIds.includes(obs.detalle_id)) {
                  coincidePago = true;
                  const det = detallesFinales.find((d: any) => d.id === obs.detalle_id);
                  if (det) servicioNombre = det.nombre;
                } else if (obs.cliente === paciente) {
                  coincidePago = true;
                  servicioNombre = obs.servicio || 'N/A';
                }
              }
            } catch {}
            
            if (coincidePago) {
              totalPagado += parseFloat(p.monto) || 0;
              pagos.push({
                orden: orden.id_externo,
                servicio: servicioNombre,
                monto: p.monto,
                metodo: p.metodo_pago,
                fecha: p.creado_en,
                referencia: p.referencia || '-'
              });
            }
          });
        }
      });
    }
  });
  
  if (ordenesEncontradas.length === 0) {
    Swal.fire('Info', `No se encontraron órdenes para "${termino}"`, 'info');
    return;
  }
  
  // ✅ Determinar el doctor principal (el que tiene más órdenes)
  const doctorCount: { [key: string]: number } = {};
  ordenesEncontradas.forEach((o: any) => {
    if (o.doctorNombre) {
      doctorCount[o.doctorNombre] = (doctorCount[o.doctorNombre] || 0) + 1;
    }
  });
  
  let doctorPrincipal = doctorEncontrado;
  let maxCount = 0;
  Object.keys(doctorCount).forEach(key => {
    if (doctorCount[key] > maxCount) {
      maxCount = doctorCount[key];
      doctorPrincipal = key;
    }
  });
  
  this.modalPacienteData = {
    doctor: doctorPrincipal || ordenesEncontradas[0]?.doctorNombre || 'N/A',
    paciente: nombrePaciente,
    ordenes: ordenesEncontradas,  // <-- Cada orden tiene doctorNombre
    totalFacturado: totalFacturado,
    totalPagado: totalPagado,
    saldo: totalFacturado - totalPagado,
    pagos: pagos
  };
  
  this.modalPacienteVisible = true;
}
}