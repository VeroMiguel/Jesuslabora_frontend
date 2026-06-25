import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrdenService } from '../../../../core/services/orden.service';
import { PagoService } from '../../../../core/services/pago.service';
import { TicketService } from '../../../../core/services/ticket.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { HoraPipe } from '../../../../shared/pipes/hora.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import Swal from 'sweetalert2';
import { ImagenPipe } from '../../../../shared/pipes/imagen.pipe';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ServicioService } from '../../../../core/services/servicio.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-orden-detalle',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    MonedaPipe, 
    FechaPipe, 
    LoadingSpinnerComponent, 
    ImagenPipe, 
    HoraPipe,
  ],
  templateUrl: './orden-detalle.component.html',
  styleUrls: ['./orden-detalle.component.css'],
  providers: [MonedaPipe]
})
export class OrdenDetalleComponent implements OnInit, OnDestroy {
  orden: any;
  cargando = true;
  totalPagado = 0;
  saldo = 0;
  fechaServidorHoy: string = '';
  fechaHoraServidor: string = '';
  fechaHoraTimestamp: number = 0;
  subiendoImagen = false;
  private subscriptions: Subscription[] = [];
  
  // ✅ Propiedades para el modal de historial de pagos por servicio
  modalHistorialVisible: boolean = false;
  modalHistorialServicio: any = null;
  modalHistorialPagos: any[] = [];
  modalHistorialTotalPagado: number = 0;
  modalHistorialSaldo: number = 0;
  
  // ✅ Propiedades para el modal de "Ver todos los pagos"
  modalTodosPagosVisible: boolean = false;
  // ============================================================
  // ✅ PROPIEDADES PARA MODAL DE CLIENTE POR SERVICIO
  // ============================================================

  modalClienteVisible: boolean = false;
  modalClienteData: any = null;
// ✅ NUEVA: Guardar referencia al detalle que se está editando
modalClienteDetalleRef: any = null;
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private ordenService: OrdenService,
    private pagoService: PagoService,
    private ticketService: TicketService,
    private monedaPipe: MonedaPipe,
    private whatsAppService: WhatsAppService,
    private servicioService: ServicioService
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.ordenService.getFechaHoraServidor().subscribe({
        next: (fechaHoraRespuesta) => {
          this.fechaServidorHoy = fechaHoraRespuesta.fecha;
          this.fechaHoraServidor = fechaHoraRespuesta.fecha_hora;
          this.fechaHoraTimestamp = fechaHoraRespuesta.timestamp;
          console.log('📅 Detalle - Fecha/Hora servidor:', this.fechaHoraServidor);
          this.cargarOrdenDesdeParams();
        },
        error: (error) => {
          console.error('Error obteniendo fecha/hora del servidor:', error);
          const ahora = new Date();
          this.fechaServidorHoy = ahora.toISOString().split('T')[0];
          this.fechaHoraServidor = ahora.toISOString();
          this.fechaHoraTimestamp = ahora.getTime();
          console.log('📅 Detalle - Usando fecha local:', this.fechaServidorHoy);
          this.cargarOrdenDesdeParams();
        }
      })
    );
  }

  private cargarOrdenDesdeParams() {
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        if (params['id']) {
          this.cargarOrden(params['id']);
        }
      })
    );
  }

  cargarOrden(id: number) {
    this.cargando = true;
    this.subscriptions.push(
      this.ordenService.getOrden(id).subscribe({
        next: (data) => {
          this.orden = data;
          this.calcularPagos();
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error cargando orden:', error);
          this.cargando = false;
          Swal.fire('Error', 'No se pudo cargar la orden', 'error');
        }
      })
    );
  }

  isVencida(): boolean {
    if (!this.orden?.fecha_limite || this.orden.estado === 'terminado') return false;
    const saldo = this.saldo;
    if (saldo <= 0) return false;
    
    let ahora: Date;
    if (this.fechaHoraTimestamp > 0) {
      ahora = new Date(this.fechaHoraTimestamp);
    } else {
      ahora = new Date();
    }
    
    const [yearL, monthL, dayL] = this.orden.fecha_limite.split('-').map(Number);
    let hora = 23, minutos = 59, segundos = 59;
    
    if (this.orden.hora_limite) {
      const horaParts = this.orden.hora_limite.split(':');
      hora = parseInt(horaParts[0]);
      minutos = parseInt(horaParts[1]);
      segundos = 0;
    }
    
    const fechaLimiteCompleta = new Date(yearL, monthL - 1, dayL, hora, minutos, segundos);
    return ahora.getTime() > fechaLimiteCompleta.getTime();
  }

  calcularPagos() {
    if (this.orden?.pagos) {
      this.totalPagado = Number(this.orden.pagos.reduce((sum: number, p: any) => sum + Number(p.monto), 0)) || 0;
      this.saldo = Number(Number(this.orden.total) - this.totalPagado) || 0;
    }
  }

  abrirSelectorImagen() {
    if (!this.orden?.servicio?.id) {
      Swal.fire('Error', 'No se pudo identificar el servicio', 'error');
      return;
    }
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  onImagenSeleccionada(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.subirImagenReferencia(input.files[0]);
      input.value = '';
    }
  }

  subirImagenReferencia(file: File) {
    console.log('📁 Archivo seleccionado para orden:', {
      nombre: file.name,
      tamaño: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      tipo: file.type
    });
    
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      Swal.fire({
        icon: 'error',
        title: 'Imagen muy grande',
        text: `La imagen no puede superar los 15MB. Actualmente pesa ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
        confirmButtonColor: '#f43f5e'
      });
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif'];
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension || '')) {
      Swal.fire({
        icon: 'error',
        title: 'Formato no soportado',
        text: 'Formatos permitidos: JPG, JPEG, PNG, GIF, WEBP, AVIF, HEIC',
        confirmButtonColor: '#f43f5e'
      });
      return;
    }

    this.subiendoImagen = true;
    const formData = new FormData();
    formData.append('imagen', file);

    this.subscriptions.push(
      this.ordenService.actualizarImagenReferencia(this.orden.id, formData).subscribe({
        next: (response) => {
          this.subiendoImagen = false;
          this.orden.imagen_referencia_url = response.imagen_url;
          Swal.fire({
            icon: 'success',
            title: '¡Imagen actualizada!',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (error) => {
          this.subiendoImagen = false;
          console.error('❌ Error subiendo imagen:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo subir la imagen.',
            confirmButtonColor: '#f43f5e'
          });
        }
      })
    );
  }

  enviarWhatsApp() {
    this.whatsAppService.enviarMensajePersonalizado({
      telefono: this.orden?.doctor?.telefono_whatsapp,
      nombre: this.orden?.doctor?.nombre,
      tipo: 'orden',
      datos: this.orden
    });
  }

  vistaPreviaTicket() {
    this.ticketService.abrirVistaPrevia(this.orden);
  }

  descargarTicket() {
    Swal.fire({
      title: 'Descargando ticket...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    
    this.ticketService.descargarTicketPDF(this.orden)
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: '¡Descargado!',
          timer: 1500,
          showConfirmButton: false
        });
      })
      .catch(error => {
        console.error(error);
        Swal.fire('Error', 'No se pudo descargar el ticket', 'error');
      });
  }

  // ============================================================
  // ✅ MÉTODOS DE PAGO
  // ============================================================

  mostrarBotonAgregarPago(): boolean {
    if (this.orden?.estado === 'terminado') return false;
    if (this.saldo <= 0) return false;
    return this.tieneClientesDiferentes();
  }

  mostrarBotonPagarServicio(detalle: any): boolean {
    if (this.orden?.estado === 'terminado') return false;
    const deuda = this.getDeudaPorServicio(detalle);
    if (deuda <= 0) return false;
    return true;
  }

  getDeudaPorServicio(detalle: any): number {
    if (!detalle) return 0;
    if (this.orden?.estado === 'terminado') return 0;
    
    const precioServicio = parseFloat(detalle.precio_unitario) || 0;
    
    const pagosDelServicio = this.orden.pagos?.filter((pago: any) => {
      if (pago.observaciones) {
        try {
          const obs = typeof pago.observaciones === 'string' 
            ? JSON.parse(pago.observaciones) 
            : pago.observaciones;
          if (obs.detalle_id === detalle.id) {
            return true;
          }
        } catch {
          // Ignorar
        }
      }
      if (pago.referencia && pago.referencia.includes(detalle.servicio?.nombre)) {
        return true;
      }
      return false;
    }) || [];
    
    const totalPagadoServicio = pagosDelServicio.reduce((sum: number, p: any) => sum + Number(p.monto), 0);
    const saldoPendiente = precioServicio - totalPagadoServicio;
    
    return Math.max(0, saldoPendiente);
  }

  tieneClientesDiferentes(): boolean {
    if (!this.orden?.detalles || this.orden.detalles.length <= 1) return false;
    
    const clientes: string[] = this.orden.detalles
      .map((d: any) => d.cliente_nombre)
      .filter((c: string) => c && c.trim() !== '');
    
    if (clientes.length === 0) return false;
    const primerCliente = clientes[0];
    return clientes.some((c: string) => c !== primerCliente);
  }

  tieneClienteUnico(): boolean {
    if (!this.orden?.detalles || this.orden.detalles.length === 0) return false;
    if (this.orden.cliente_nombre) return true;
    
    const clientes: string[] = this.orden.detalles
      .map((d: any) => d.cliente_nombre)
      .filter((c: string) => c && c.trim() !== '');
    
    if (clientes.length === 0) return false;
    const primerCliente = clientes[0];
    return clientes.every((c: string) => c === primerCliente);
  }

  getClienteServicio(detalle: any): string {
    if (this.orden.cliente_nombre) return this.orden.cliente_nombre;
    return detalle.cliente_nombre || 'Sin cliente';
  }

  /**
   * ✅ Obtiene los pagos filtrados por un servicio específico
   */
  getPagosPorServicio(detalle: any): any[] {
    if (!this.orden?.pagos) return [];
    
    return this.orden.pagos.filter((pago: any) => {
      // Buscar por detalle_id en observaciones
      if (pago.observaciones) {
        try {
          const obs = typeof pago.observaciones === 'string' 
            ? JSON.parse(pago.observaciones) 
            : pago.observaciones;
          if (obs.detalle_id === detalle.id) {
            return true;
          }
        } catch {
          // Ignorar
        }
      }
      // Buscar por nombre del servicio en referencia
      if (pago.referencia && pago.referencia.includes(detalle.servicio?.nombre)) {
        return true;
      }
      return false;
    });
  }

  /**
   * ✅ Abre el modal de historial de pagos por servicio
   */
  abrirHistorialServicio(detalle: any) {
    const pagos = this.getPagosPorServicio(detalle);
    const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const precioServicio = parseFloat(detalle.precio_unitario) || 0;
    const saldo = precioServicio - totalPagado;
    
    this.modalHistorialServicio = detalle;
    this.modalHistorialPagos = pagos;
    this.modalHistorialTotalPagado = totalPagado;
    this.modalHistorialSaldo = Math.max(0, saldo);
    this.modalHistorialVisible = true;
  }

  /**
   * ✅ Cierra el modal de historial de pagos
   */
  cerrarHistorialServicio() {
    this.modalHistorialVisible = false;
    this.modalHistorialServicio = null;
    this.modalHistorialPagos = [];
  }

  /**
   * ✅ Abre el modal de "Ver todos los pagos"
   */
  abrirHistorialCompleto() {
    this.modalTodosPagosVisible = true;
  }

  /**
   * ✅ Cierra el modal de "Ver todos los pagos"
   */
  cerrarTodosPagos() {
    this.modalTodosPagosVisible = false;
  }

  pagarServicio(detalle: any, index: number) {
    const montoMaximo = this.getDeudaPorServicio(detalle);
    const cliente = this.getClienteServicio(detalle);
    const servicioNombre = detalle.servicio?.nombre || 'Servicio';
    
    if (montoMaximo <= 0) {
      Swal.fire('Info', `El servicio "${servicioNombre}" ya está pagado`, 'info');
      return;
    }

    Swal.fire({
      title: `💳 Pagar Servicio: ${servicioNombre}`,
      html: `
        <div style="text-align: left; margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 12px;">
          <p style="margin: 4px 0;"><strong>👤 Cliente:</strong> ${cliente}</p>
          <p style="margin: 4px 0;"><strong>💼 Servicio:</strong> ${servicioNombre}</p>
          <p style="margin: 4px 0;"><strong>💰 Precio:</strong> ${this.monedaPipe.transform(detalle.precio_unitario)}</p>
          <p style="margin: 4px 0; color: ${montoMaximo > 0 ? '#f43f5e' : '#10b981'}; font-weight: 700;">
            <strong>💳 Saldo pendiente:</strong> ${this.monedaPipe.transform(montoMaximo)}
          </p>
        </div>
        <input type="number" id="monto" class="swal2-input" 
               placeholder="Monto (S/)" step="0.01" min="0.01" 
               max="${montoMaximo}" value="${montoMaximo.toFixed(2)}">
        <select id="metodo" class="swal2-select" style="width: 100%; margin-bottom: 10px;">
          <option value="efectivo">💵 Efectivo</option>
          <option value="tarjeta">💳 Tarjeta</option>
          <option value="transferencia">🏦 Transferencia</option>
          <option value="yape">📱 Yape</option>
          <option value="plin">📱 Plin</option>
        </select>
        <input type="text" id="referencia" class="swal2-input" placeholder="Referencia (opcional)">
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 8px;">
          <i class="fas fa-info-circle"></i> Este pago se registrará para el servicio "<strong>${servicioNombre}</strong>"
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '✅ Registrar Pago',
      cancelButtonText: '❌ Cancelar',
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
        
        if (montoNumerico > montoMaximo) {
          Swal.showValidationMessage(`El monto no puede exceder el saldo pendiente (${this.monedaPipe.transform(montoMaximo)})`);
          return false;
        }
        
        return { 
          monto: montoNumerico, 
          metodo_pago: metodo, 
          referencia,
          detalleId: detalle.id,
          servicioNombre: servicioNombre,
          cliente: cliente
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.registrarPagoConDetalle(result.value);
      }
    });
  }

  agregarPago() {
    const saldoActual = this.saldo;
    
    if (saldoActual <= 0) {
      Swal.fire('Info', 'Esta orden ya está pagada', 'info');
      return;
    }

    const serviciosConDeuda = this.orden.detalles.filter((d: any) => {
      return this.getDeudaPorServicio(d) > 0;
    });

    let distribucionPreview = '';
    if (serviciosConDeuda.length > 1) {
      const deudaTotal = serviciosConDeuda.reduce((sum: number, d: any) => {
        return sum + this.getDeudaPorServicio(d);
      }, 0);
      
      distribucionPreview = `<div style="margin-top: 10px; padding: 12px; background: #f8fafc; border-radius: 8px; text-align: left;">
        <p style="font-weight: 600; margin-bottom: 8px;">📊 Distribución del pago:</p>`;
      
      serviciosConDeuda.forEach((d: any) => {
        const deuda = this.getDeudaPorServicio(d);
        const proporcion = (deuda / deudaTotal) * 100;
        distribucionPreview += `<p style="margin: 2px 0; font-size: 0.85rem;">
          ${d.servicio?.nombre}: ${proporcion.toFixed(0)}% (${this.monedaPipe.transform(deuda)} pendiente)
        </p>`;
      });
      
      distribucionPreview += `</div>`;
    }

    Swal.fire({
      title: '📝 Registrar Pago Global',
      html: `
        <input type="number" id="monto" class="swal2-input" 
               placeholder="Monto (S/)" step="0.01" min="0.01" 
               max="${saldoActual}" value="${saldoActual.toFixed(2)}">
        <select id="metodo" class="swal2-select" style="width: 100%; margin-bottom: 10px;">
          <option value="efectivo">💵 Efectivo</option>
          <option value="tarjeta">💳 Tarjeta</option>
          <option value="transferencia">🏦 Transferencia</option>
          <option value="yape">📱 Yape</option>
          <option value="plin">📱 Plin</option>
        </select>
        <input type="text" id="referencia" class="swal2-input" placeholder="Referencia (opcional)">
        <div class="swal2-text" style="font-size:0.9rem; color:#64748b; margin-top:10px;">
          <strong>Saldo pendiente total:</strong> ${this.monedaPipe.transform(saldoActual)}
        </div>
        ${distribucionPreview}
      `,
      showCancelButton: true,
      confirmButtonText: '✅ Registrar',
      cancelButtonText: '❌ Cancelar',
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
        
        if (montoNumerico > saldoActual) {
          Swal.showValidationMessage(`El monto no puede exceder el saldo pendiente (${this.monedaPipe.transform(saldoActual)})`);
          return false;
        }
        
        return { 
          monto: montoNumerico, 
          metodo_pago: metodo, 
          referencia
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.registrarPagoGlobal(result.value);
      }
    });
  }

  registrarPagoGlobal(data: any) {
    const serviciosConDeuda = this.orden.detalles.filter((d: any) => {
      return this.getDeudaPorServicio(d) > 0;
    });

    if (serviciosConDeuda.length === 0) {
      Swal.fire('Info', 'Todos los servicios ya están pagados', 'info');
      return;
    }

    const deudaTotal = serviciosConDeuda.reduce((sum: number, d: any) => {
      return sum + this.getDeudaPorServicio(d);
    }, 0);

    let pagosRegistrados = 0;

    serviciosConDeuda.forEach((d: any) => {
      const proporcion = (this.getDeudaPorServicio(d) / deudaTotal) * data.monto;
      if (proporcion > 0) {
        const montoRedondeado = Math.round(proporcion * 100) / 100;
        const referencia = `Pago distribuido para ${d.servicio?.nombre}`;
        
        this.subscriptions.push(
          this.pagoService.registrarPago({
            orden_id: Number(this.orden.id),
            monto: montoRedondeado,
            metodo_pago: data.metodo_pago,
            referencia: referencia,
            observaciones: JSON.stringify({
              detalle_id: d.id,
              servicio: d.servicio?.nombre,
              cliente: this.getClienteServicio(d)
            })
          }).subscribe({
            next: () => {
              pagosRegistrados++;
              if (pagosRegistrados === serviciosConDeuda.length) {
                Swal.fire({
                  icon: 'success',
                  title: '¡Pago registrado!',
                  text: `Pago de ${this.monedaPipe.transform(data.monto)} registrado correctamente`,
                  timer: 2000,
                  showConfirmButton: false
                });
                this.cargarOrden(this.orden.id);
              }
            },
            error: (error) => {
              console.error('❌ Error registrando pago:', error);
            }
          })
        );
      }
    });
  }

  registrarPagoConDetalle(data: any) {
    const ordenId = this.orden.id;
    const referencia = data.referencia || `Pago para ${data.servicioNombre}`;
    
    console.log('📝 [DEBUG] Registrando pago para servicio:', {
      orden_id: ordenId,
      detalle_id: data.detalleId,
      servicio: data.servicioNombre,
      cliente: data.cliente,
      monto: data.monto,
      metodo: data.metodo_pago,
      referencia: referencia
    });
    
    this.subscriptions.push(
      this.pagoService.registrarPago({
        orden_id: Number(ordenId),
        monto: data.monto,
        metodo_pago: data.metodo_pago,
        referencia: referencia,
        observaciones: JSON.stringify({
          detalle_id: data.detalleId,
          servicio: data.servicioNombre,
          cliente: data.cliente
        })
      }).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: '¡Pago registrado!',
            text: `Pago de ${this.monedaPipe.transform(data.monto)} para "${data.servicioNombre}" registrado correctamente`,
            timer: 2000,
            showConfirmButton: false
          });
          this.cargarOrden(this.orden.id);
        },
        error: (error) => {
          console.error('❌ Error registrando pago:', error);
          Swal.fire('Error', 'No se pudo registrar el pago', 'error');
        }
      })
    );
  }

  // ============================================================
  // OTROS MÉTODOS
  // ============================================================

  editarPago(pago: any) {
    const saldoActual = Number(this.saldo) + Number(pago.monto);

    Swal.fire({
      title: 'Editar Pago',
      html: `
        <input type="number" id="monto" class="swal2-input" 
               value="${pago.monto}" step="0.01" min="0.01" 
               max="${saldoActual}" placeholder="Monto (S/)">
        <select id="metodo" class="swal2-select" style="width: 100%; margin-bottom: 10px;">
          <option value="efectivo" ${pago.metodo_pago === 'efectivo' ? 'selected' : ''}>💵 Efectivo</option>
          <option value="tarjeta" ${pago.metodo_pago === 'tarjeta' ? 'selected' : ''}>💳 Tarjeta</option>
          <option value="transferencia" ${pago.metodo_pago === 'transferencia' ? 'selected' : ''}>🏦 Transferencia</option>
          <option value="yape" ${pago.metodo_pago === 'yape' ? 'selected' : ''}>📱 Yape</option>
          <option value="plin" ${pago.metodo_pago === 'plin' ? 'selected' : ''}>📱 Plin</option>
        </select>
        <input type="text" id="referencia" class="swal2-input" 
               value="${pago.referencia || ''}" placeholder="Referencia (opcional)">
        <div class="swal2-text" style="font-size:0.9rem; color:#64748b; margin-top:10px;">
          Monto máximo permitido: ${this.monedaPipe.transform(saldoActual)}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
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
        
        if (montoNumerico > saldoActual) {
          Swal.showValidationMessage(`El monto no puede exceder el saldo actual (${this.monedaPipe.transform(saldoActual)})`);
          return false;
        }
        
        return { id: pago.id, monto: montoNumerico, metodo_pago: metodo, referencia };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.subscriptions.push(
          this.pagoService.actualizarPago(result.value.id, {
            monto: result.value.monto,
            metodo_pago: result.value.metodo_pago,
            referencia: result.value.referencia
          }).subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: 'Pago actualizado correctamente',
                timer: 1500,
                showConfirmButton: false
              });
              this.cargarOrden(this.orden.id);
            },
            error: (error) => {
              console.error('Error actualizando pago:', error);
              if (error.error && error.error.error) {
                Swal.fire('Error', error.error.error, 'error');
              } else {
                Swal.fire('Error', 'No se pudo actualizar el pago', 'error');
              }
            }
          })
        );
      }
    });
  }

  eliminarPago(pagoId: number) {
    Swal.fire({
      title: '¿Eliminar pago?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.subscriptions.push(
          this.pagoService.eliminarPago(pagoId).subscribe({
            next: () => {
              Swal.fire('¡Eliminado!', 'Pago eliminado correctamente', 'success');
              this.cargarOrden(this.orden.id);
            },
            error: (error) => {
              console.error('Error eliminando pago:', error);
              Swal.fire('Error', 'No se pudo eliminar el pago', 'error');
            }
          })
        );
      }
    });
  }

  editarDetalleCliente() {
    Swal.fire({
      title: 'Editar Detalle del Cliente',
      html: `
        <div style="text-align: left;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600;">Cliente:</label>
          <input id="cliente-nombre" class="swal2-input" 
                 value="${this.orden.cliente_nombre || ''}" 
                 placeholder="Nombre del paciente"
                 style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600;">Detalle del Caso:</label>
          <textarea id="detalle-cliente" class="swal2-textarea" 
                    rows="5" 
                    placeholder="Ej: Diente #16, necesita corona, paciente alérgico...">${this.orden.detalle_cliente || ''}</textarea>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 8px;">
            <i class="fas fa-info-circle"></i> Incluya información relevante
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const clienteNombre = (document.getElementById('cliente-nombre') as HTMLInputElement).value;
        const detalleCliente = (document.getElementById('detalle-cliente') as HTMLTextAreaElement).value;
        if (!clienteNombre.trim()) {
          Swal.showValidationMessage('El nombre del cliente es requerido');
          return false;
        }
        return { cliente_nombre: clienteNombre, detalle_cliente: detalleCliente };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.subscriptions.push(
          this.ordenService.actualizarOrden(this.orden.id, {
            cliente_nombre: result.value.cliente_nombre,
            detalle_cliente: result.value.detalle_cliente
          }).subscribe({
            next: () => {
              this.orden.cliente_nombre = result.value.cliente_nombre;
              this.orden.detalle_cliente = result.value.detalle_cliente;
              Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                timer: 1500,
                showConfirmButton: false
              });
            },
            error: (error) => {
              console.error('Error actualizando cliente:', error);
              Swal.fire('Error', 'No se pudo actualizar la información', 'error');
            }
          })
        );
      }
    });
  }

  isDetalleVencido(detalle: any): boolean {
    if (!detalle.fecha_limite) return false;
    
    let ahora: Date;
    if (this.fechaHoraTimestamp > 0) {
      ahora = new Date(this.fechaHoraTimestamp);
    } else {
      ahora = new Date();
    }
    
    const [yearL, monthL, dayL] = detalle.fecha_limite.split('-').map(Number);
    let hora = 23, minutos = 59;
    
    if (detalle.hora_limite) {
      const horaParts = detalle.hora_limite.split(':');
      hora = parseInt(horaParts[0]);
      minutos = parseInt(horaParts[1]);
    }
    
    const fechaLimiteCompleta = new Date(yearL, monthL - 1, dayL, hora, minutos);
    return ahora.getTime() > fechaLimiteCompleta.getTime();
  }

  async verImagenServicio(url: string) {
    let imagenUrl = url;
    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      imagenUrl = `${baseUrl}${url}`;
    }
    
    console.log('🔍 Mostrando imagen:', imagenUrl);
    const img = new Image();
    img.src = imagenUrl;
    
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    
    const maxWidth = window.innerWidth * 0.8;
    const maxHeight = window.innerHeight * 0.8;
    let imageWidth = img.width;
    let imageHeight = img.height;
    
    if (imageWidth > maxWidth || imageHeight > maxHeight) {
      const ratio = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
      imageWidth = imageWidth * ratio;
      imageHeight = imageHeight * ratio;
    }
    
    try {
      await Swal.fire({
        imageUrl: imagenUrl,
        imageAlt: 'Imagen de referencia del servicio',
        width: `${imageWidth + 40}px`,
        showConfirmButton: true,
        confirmButtonText: 'Cerrar',
        imageWidth: `${imageWidth}px`,
        imageHeight: `${imageHeight}px`,
        backdrop: true,
        allowOutsideClick: true,
        customClass: {
          image: 'servicio-imagen-modal'
        }
      });
    } catch (err) {
      console.error('Error mostrando imagen:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la imagen'
      });
    }
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/default-image.png';
    console.warn('Error cargando imagen, usando default');
  }

  /**
   * ✅ Abre el modal de detalle del cliente con información completa
   */
  abrirModalCliente() {
    if (!this.orden.cliente_nombre) return;
    
    Swal.fire({
      title: '👤 Información del Cliente',
      html: `
        <div style="text-align: left; padding: 10px 0;">
          <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 12px;">
            <p style="margin: 4px 0;"><strong>Nombre:</strong> ${this.orden.cliente_nombre}</p>
          </div>
          ${this.orden.detalle_cliente ? `
            <div style="padding: 12px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #6366f1;">
              <p style="margin: 0 0 4px 0;"><strong>📋 Detalle del Caso:</strong></p>
              <p style="margin: 4px 0 0 0; color: #475569; line-height: 1.6; white-space: pre-wrap;">${this.orden.detalle_cliente}</p>
            </div>
          ` : `
            <div style="padding: 12px; background: #f8fafc; border-radius: 12px; color: #94a3b8; font-style: italic; text-align: center;">
              <i class="fas fa-info-circle"></i> Sin detalles adicionales
            </div>
          `}
          ${this.orden.detalles && this.orden.detalles.length > 0 ? `
            <div style="margin-top: 16px; padding: 12px; background: #f1f5f9; border-radius: 12px;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">📊 Servicios asociados:</p>
              ${this.orden.detalles.map((d: any) => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">
                  <span>${d.servicio?.nombre || 'Sin servicio'}</span>
                  <span style="color: #10b981; font-weight: 600;">${this.monedaPipe.transform(d.precio_unitario)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#6366f1',
      width: '450px'
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    console.log('🧹 OrdenDetalleComponent destruido');
  }
/**
 * ✅ Abre el modal de detalle del cliente desde el servicio
 */
abrirModalClienteServicio(detalle: any) {
  const clienteNombre = this.getClienteServicio(detalle);
  
  // ✅ Obtener el detalle del caso (puede venir del detalle o de la orden)
  let detalleCaso = null;
  
  // Primero buscar en el detalle específico
  if (detalle.detalle_cliente) {
    detalleCaso = detalle.detalle_cliente;
  } 
  // Si no, buscar en la orden (para cliente único)
  else if (this.orden.detalle_cliente) {
    detalleCaso = this.orden.detalle_cliente;
  }
  
  // Obtener todos los servicios de este cliente
  let serviciosDelCliente = [];
  
  if (this.tieneClienteUnico()) {
    // Si es cliente único, mostrar todos los servicios
    serviciosDelCliente = this.orden.detalles.map((d: any) => ({
      nombre: d.servicio?.nombre || 'Sin servicio',
      precio: d.precio_unitario
    }));
  } else {
    // Si son clientes diferentes, mostrar solo los servicios de este cliente
    serviciosDelCliente = this.orden.detalles
      .filter((d: any) => d.cliente_nombre === clienteNombre)
      .map((d: any) => ({
        nombre: d.servicio?.nombre || 'Sin servicio',
        precio: d.precio_unitario
      }));
  }
  
  // ✅ Guardar los datos completos del cliente
  this.modalClienteData = {
    nombre: clienteNombre,
    detalle: detalleCaso,
    servicios: serviciosDelCliente,
    detalleRef: detalle,
    esClienteUnico: this.tieneClienteUnico()
  };
  
  // ✅ Guardar la referencia del detalle
  this.modalClienteDetalleRef = detalle;
  
  this.modalClienteVisible = true;
}

/**
 * ✅ Cierra el modal de cliente
 */
cerrarModalCliente() {
  this.modalClienteVisible = false;
  this.modalClienteData = null;
  this.modalClienteDetalleRef = null;
}

/**
 * ✅ Abre el editor de cliente desde el modal
 * ✅ AHORA FUNCIONA PARA CLIENTE ÚNICO Y CLIENTES DIFERENTES
 */
editarDetalleClienteDesdeModal() {
  // ✅ Obtener el detalle que se está editando ANTES de cerrar el modal
  const detalle = this.modalClienteDetalleRef;
  
  // ✅ Guardar los datos del cliente antes de cerrar
  let clienteNombre = '';
  let detalleCaso = '';
  
  if (detalle) {
    // Si hay un detalle, usar sus datos
    clienteNombre = detalle.cliente_nombre || '';
    detalleCaso = detalle.detalle_cliente || '';
  } else if (this.orden.cliente_nombre) {
    // Si no hay detalle pero la orden tiene cliente, usar los de la orden
    clienteNombre = this.orden.cliente_nombre || '';
    detalleCaso = this.orden.detalle_cliente || '';
  }
  
  // ✅ Cerrar el modal de información del cliente
  this.cerrarModalCliente();
  
  // ✅ Verificar si es cliente único o múltiple
  const esClienteUnico = this.tieneClienteUnico();
  
  if (esClienteUnico) {
    // ✅ Si es cliente único, usar el método existente (edita la orden)
    this.editarDetalleCliente();
  } else if (detalle) {
    // ✅ Si es cliente diferente por servicio, editar el detalle específico
    // ✅ PASAR EL DETALLE CON LOS DATOS ACTUALES
    this.editarDetalleClientePorServicio(detalle, clienteNombre, detalleCaso);
  } else {
    // Fallback: usar el método general
    this.editarDetalleCliente();
  }
}
/**
 * ✅ Edita el cliente y detalle de un servicio específico (para clientes diferentes)
 * ✅ MODIFICADO: recibe los datos directamente para evitar que se pierdan
 */
editarDetalleClientePorServicio(detalle: any, clienteNombre?: string, detalleCaso?: string) {
  // ✅ Usar los valores pasados o los del detalle
  const nombreCliente = clienteNombre !== undefined ? clienteNombre : (detalle.cliente_nombre || '');
  const detalleCliente = detalleCaso !== undefined ? detalleCaso : (detalle.detalle_cliente || '');
  
  Swal.fire({
    title: 'Editar Detalle del Cliente',
    html: `
      <div style="text-align: left;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Cliente:</label>
        <input id="cliente-nombre-modal" class="swal2-input" 
               value="${nombreCliente}" 
               placeholder="Nombre del paciente"
               style="margin-bottom: 16px;">
        
        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Detalle del Caso:</label>
        <textarea id="detalle-cliente-modal" class="swal2-textarea" 
                  rows="5" 
                  placeholder="Ej: Diente #16, necesita corona, paciente alérgico...">${detalleCliente}</textarea>
        
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 8px;">
          <i class="fas fa-info-circle"></i> Incluya información relevante como:
          pieza dental, lado (superior/inferior), materiales especiales, alergias, etc.
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Guardar cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = (document.getElementById('cliente-nombre-modal') as HTMLInputElement).value;
      const detalleTexto = (document.getElementById('detalle-cliente-modal') as HTMLTextAreaElement).value;
      
      if (!nombre.trim()) {
        Swal.showValidationMessage('El nombre del cliente es requerido');
        return false;
      }
      
      return { cliente_nombre: nombre, detalle_cliente: detalleTexto };
    }
  }).then((result) => {
    if (result.isConfirmed) {
      // ✅ Actualizar el detalle específico en la base de datos
      this.subscriptions.push(
        this.ordenService.actualizarDetalleOrden(detalle.id, {
          cliente_nombre: result.value.cliente_nombre,
          detalle_cliente: result.value.detalle_cliente
        }).subscribe({
          next: () => {
            // ✅ Actualizar localmente el detalle
            detalle.cliente_nombre = result.value.cliente_nombre;
            detalle.detalle_cliente = result.value.detalle_cliente;
            
            // ✅ También actualizar en modalClienteData si existe
            if (this.modalClienteData) {
              this.modalClienteData.nombre = result.value.cliente_nombre;
              this.modalClienteData.detalle = result.value.detalle_cliente;
            }
            
            Swal.fire({
              icon: 'success',
              title: 'Actualizado',
              text: 'La información del cliente se ha actualizado correctamente',
              timer: 1500,
              showConfirmButton: false
            });
            
            // ✅ Recargar la orden para actualizar todo
            this.cargarOrden(this.orden.id);
          },
          error: (error) => {
            console.error('Error actualizando cliente del servicio:', error);
            Swal.fire('Error', 'No se pudo actualizar la información', 'error');
          }
        })
      );
    }
  });
}
}