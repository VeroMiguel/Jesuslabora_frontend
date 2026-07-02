import { Component, OnInit, OnDestroy, ViewChild, ViewChildren, ElementRef, QueryList } from '@angular/core';
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
  
  // ✅ Propiedades para modal de cliente por servicio
  modalClienteVisible: boolean = false;
  modalClienteData: any = null;
  modalClienteDetalleRef: any = null;
    // ✅ Propiedad para almacenar el índice del detalle que está subiendo imagen
  detalleSubiendoImagen: number | null = null;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
// ✅ Array de ViewChildren para los inputs de archivo por detalle
@ViewChildren('fileInputDetalle') fileInputsDetalle!: QueryList<ElementRef<HTMLInputElement>>;
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
    
    // ✅ Usar getPagosPorServicio para consistencia
    const pagosDelServicio = this.getPagosPorServicio(detalle);
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
   * ✅ CORREGIDO: Filtra estrictamente por detalle_id
   */
  getPagosPorServicio(detalle: any): any[] {
    if (!this.orden?.pagos) return [];
    
    const pagosFiltrados: any[] = [];
    const detalleId = detalle.id;
    const servicioNombre = detalle.servicio?.nombre || '';
    
    console.log('📊 getPagosPorServicio - Buscando pagos para detalle ID:', detalleId);
    
    for (const pago of this.orden.pagos) {
      let detalleIdEncontrado = null;
      let servicioEncontrado = null;
      
      if (pago.observaciones) {
        try {
          let obs = pago.observaciones;
          if (typeof obs === 'string') {
            obs = JSON.parse(obs);
          }
          detalleIdEncontrado = obs.detalle_id || null;
          servicioEncontrado = obs.servicio || null;
        } catch {}
      }
      
      // ✅ SOLO incluir si el detalle_id coincide EXACTAMENTE
      if (detalleIdEncontrado !== null && detalleIdEncontrado === detalleId) {
        console.log('✅ Pago encontrado por detalle_id:', pago.id);
        pagosFiltrados.push(pago);
      }
      // 🔍 Fallback: si no tiene detalle_id, usar servicio
      else if (detalleIdEncontrado === null && servicioEncontrado === servicioNombre) {
        console.log('⚠️ Pago encontrado por servicio (fallback):', pago.id);
        pagosFiltrados.push(pago);
      }
    }
    
    console.log('📊 getPagosPorServicio - Pagos encontrados:', pagosFiltrados.length);
    return pagosFiltrados;
  }

  /**
   * ✅ Abre el modal de historial de pagos por servicio
   */
  abrirHistorialServicio(detalle: any) {
    // ✅ Usar getPagosPorServicio (ya corregido)
    const pagos = this.getPagosPorServicio(detalle);
    const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const precioServicio = parseFloat(detalle.precio_unitario) || 0;
    const saldo = precioServicio - totalPagado;
    
    console.log('📊 === HISTORIAL POR SERVICIO ===');
    console.log('📌 Servicio:', detalle.servicio?.nombre);
    console.log('📌 Detalle ID:', detalle.id);
    console.log('📌 Pagos encontrados:', pagos.length);
    pagos.forEach((p: any) => {
      console.log('  - Monto:', p.monto, '| Ref:', p.referencia);
    });
    console.log('📊 Total pagado:', totalPagado);
    console.log('📊 === FIN ===');
    
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
          <p style="margin: 4px 0; font-size: 0.8rem; color: #64748b;">
            <strong>📌 Detalle ID:</strong> ${detalle.id}
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
        
        // ✅ Asegurar que el detalle_id se incluya correctamente
        return { 
          monto: montoNumerico, 
          metodo_pago: metodo, 
          referencia: referencia || `Pago para ${servicioNombre}`,
          detalleId: detalle.id,
          servicioNombre: servicioNombre,
          cliente: cliente
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        console.log('📝 Datos del pago a registrar:', result.value);
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

  // ============================================================
  // ✅ MÉTODOS DE CLIENTE
  // ============================================================

  /**
   * ✅ Abre el modal de detalle del cliente desde el servicio
   */
  abrirModalClienteServicio(detalle: any) {
    const clienteNombre = this.getClienteServicio(detalle);
    
    let detalleCaso = null;
    
    if (detalle.detalle_cliente) {
      detalleCaso = detalle.detalle_cliente;
    } else if (this.orden.detalle_cliente) {
      detalleCaso = this.orden.detalle_cliente;
    }
    
    let serviciosDelCliente = [];
    
    if (this.tieneClienteUnico()) {
      serviciosDelCliente = this.orden.detalles.map((d: any) => ({
        nombre: d.servicio?.nombre || 'Sin servicio',
        precio: d.precio_unitario
      }));
    } else {
      serviciosDelCliente = this.orden.detalles
        .filter((d: any) => d.cliente_nombre === clienteNombre)
        .map((d: any) => ({
          nombre: d.servicio?.nombre || 'Sin servicio',
          precio: d.precio_unitario
        }));
    }
    
    this.modalClienteData = {
      nombre: clienteNombre,
      detalle: detalleCaso,
      servicios: serviciosDelCliente,
      detalleRef: detalle,
      esClienteUnico: this.tieneClienteUnico()
    };
    
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
   */
  editarDetalleClienteDesdeModal() {
    const detalle = this.modalClienteDetalleRef;
    
    let clienteNombre = '';
    let detalleCaso = '';
    
    if (detalle) {
      clienteNombre = detalle.cliente_nombre || '';
      detalleCaso = detalle.detalle_cliente || '';
    } else if (this.orden.cliente_nombre) {
      clienteNombre = this.orden.cliente_nombre || '';
      detalleCaso = this.orden.detalle_cliente || '';
    }
    
    this.cerrarModalCliente();
    
    const esClienteUnico = this.tieneClienteUnico();
    
    if (esClienteUnico) {
      this.editarDetalleCliente();
    } else if (detalle) {
      this.editarDetalleClientePorServicio(detalle, clienteNombre, detalleCaso);
    } else {
      this.editarDetalleCliente();
    }
  }

  /**
   * ✅ Edita el cliente y detalle de un servicio específico
   */
  editarDetalleClientePorServicio(detalle: any, clienteNombre?: string, detalleCaso?: string) {
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
            <i class="fas fa-info-circle"></i> Incluya información relevante
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
        this.subscriptions.push(
          this.ordenService.actualizarDetalleOrden(detalle.id, {
            cliente_nombre: result.value.cliente_nombre,
            detalle_cliente: result.value.detalle_cliente
          }).subscribe({
            next: () => {
              detalle.cliente_nombre = result.value.cliente_nombre;
              detalle.detalle_cliente = result.value.detalle_cliente;
              if (this.modalClienteData) {
                this.modalClienteData.nombre = result.value.cliente_nombre;
                this.modalClienteData.detalle = result.value.detalle_cliente;
              }
              Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                timer: 1500,
                showConfirmButton: false
              });
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

  /**
   * ✅ Copia texto al portapapeles
   */
  copiarTexto(texto: string) {
    if (!texto) return;
    
    navigator.clipboard.writeText(texto).then(() => {
      Swal.fire({
        icon: 'success',
        title: '¡Copiado!',
        text: `"${texto}" copiado al portapapeles`,
        timer: 1500,
        showConfirmButton: false
      });
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      Swal.fire({
        icon: 'success',
        title: '¡Copiado!',
        text: `"${texto}" copiado al portapapeles`,
        timer: 1500,
        showConfirmButton: false
      });
    });
  }

  /**
   * ✅ Obtiene el código de paciente para un servicio
   */
  getCodigoPaciente(detalle: any): string {
    if (this.orden.cliente_codigo) return this.orden.cliente_codigo;
    return detalle.cliente_codigo || '';
  }

  // ============================================================
  // ✅ MÉTODOS DE TICKET POR CLIENTE
  // ============================================================

  /**
   * ✅ Abre vista previa del ticket filtrado por un servicio específico
   */
  vistaPreviaTicketPorCliente(clienteNombre: string, detalle?: any) {
    if (!detalle) {
      const ordenFiltrada = this.filtrarOrdenPorCliente(clienteNombre);
      this.ticketService.abrirVistaPrevia(ordenFiltrada);
      return;
    }
    
    // ✅ Siempre usar filtrarOrdenPorServicio
    const ordenFiltrada = this.filtrarOrdenPorServicio(detalle);
    this.ticketService.abrirVistaPrevia(ordenFiltrada);
  }

  /**
   * ✅ Filtra la orden para mostrar solo los servicios de un cliente
   */
  filtrarOrdenPorCliente(clienteNombre: string): any {
    const esClienteUnico = this.tieneClienteUnico();
    
    let detallesFiltrados: any[] = [];
    
    if (esClienteUnico) {
      detallesFiltrados = this.orden.detalles.map((d: any) => ({
        ...d,
        cliente_nombre: clienteNombre
      }));
    } else {
      detallesFiltrados = this.orden.detalles.filter((d: any) => {
        const clienteDetalle = d.cliente_nombre || this.orden.cliente_nombre;
        return clienteDetalle === clienteNombre;
      });
    }
    
    if (detallesFiltrados.length === 0) {
      return this.orden;
    }
    
    const detallesIds = detallesFiltrados.map((d: any) => d.id);
    const detallesNombres = detallesFiltrados.map((d: any) => d.servicio?.nombre || '');
    
    const pagosFiltrados = this.orden.pagos?.filter((pago: any) => {
      try {
        if (pago.observaciones) {
          const obs = typeof pago.observaciones === 'string' 
            ? JSON.parse(pago.observaciones) 
            : pago.observaciones;
          if (obs.detalle_id && detallesIds.includes(obs.detalle_id)) {
            return true;
          }
          if (obs.cliente === clienteNombre) {
            return true;
          }
          if (obs.servicio && detallesNombres.includes(obs.servicio)) {
            return true;
          }
        }
      } catch {}
      
      if (pago.referencia) {
        if (pago.referencia.includes(clienteNombre)) {
          return true;
        }
        for (const nombre of detallesNombres) {
          if (pago.referencia.includes(nombre)) {
            return true;
          }
        }
      }
      
      return false;
    }) || [];
    
    const totalFiltrado = detallesFiltrados.reduce((sum: number, d: any) => 
      sum + (parseFloat(d.precio_unitario) || 0), 0
    );
    
    const totalPagadoFiltrado = pagosFiltrados.reduce((sum: number, p: any) => 
      sum + (parseFloat(p.monto) || 0), 0
    );
    
    return {
      ...this.orden,
      detalles: detallesFiltrados,
      pagos: pagosFiltrados,
      total: totalFiltrado,
      totalPagado: totalPagadoFiltrado,
      cliente_nombre: clienteNombre,
      doctor: this.orden.doctor
    };
  }

  /**
   * ✅ Obtiene los clientes únicos de la orden
   */
  getClientesUnicos(): string[] {
    if (this.orden.cliente_nombre) {
      return [this.orden.cliente_nombre];
    }
    
    const clientes: string[] = this.orden.detalles
      .map((d: any) => d.cliente_nombre)
      .filter((c: string) => c && c.trim() !== '');
    
    if (clientes.length === 0 && this.orden.cliente_nombre) {
      return [this.orden.cliente_nombre];
    }
    
    return Array.from(new Set(clientes));
  }

  // ============================================================
  // ✅ MÉTODO PARA ENVIAR WHATSAPP POR SERVICIO
  // ============================================================

  /**
   * ✅ Envía mensaje de WhatsApp filtrado por un servicio específico
   */
  enviarWhatsAppPorServicio(detalle: any) {
    const ordenFiltrada = this.filtrarOrdenPorServicio(detalle);
    
    console.log('📱 === WHATSAPP POR SERVICIO ===');
    console.log('📌 Servicio:', detalle.servicio?.nombre);
    console.log('📌 Total:', ordenFiltrada.total);
    console.log('📌 Pagado:', ordenFiltrada.totalPagado);
    console.log('📌 Pagos:', ordenFiltrada.pagos?.length || 0);
    console.log('📱 === FIN ===');
    
    this.whatsAppService.enviarMensajePersonalizado({
      telefono: this.orden?.doctor?.telefono_whatsapp,
      nombre: this.orden?.doctor?.nombre,
      tipo: 'orden',
      datos: ordenFiltrada
    });
  }

  // ============================================================
  // ✅ MÉTODO FILTRAR ORDEN POR SERVICIO - CORREGIDO
  // ============================================================

  /**
   * ✅ Filtra la orden para mostrar solo un servicio específico
   * ✅ CORREGIDO: Filtra pagos por detalle_id de forma estricta
   */
  filtrarOrdenPorServicio(detalle: any): any {
    console.log('🔍 === INICIO filtrarOrdenPorServicio ===');
    console.log('📌 Detalle ID del servicio:', detalle.id);
    console.log('📌 Servicio:', detalle.servicio?.nombre);
    console.log('📌 Cliente:', this.getClienteServicio(detalle));
    console.log('📌 Total pagos en orden:', this.orden.pagos?.length || 0);
    
    // ✅ Obtener solo el detalle específico
    const detalleFiltrado = this.orden.detalles.filter((d: any) => d.id === detalle.id);
    
    if (detalleFiltrado.length === 0) {
      return this.orden;
    }
    
    const precioUnitario = parseFloat(detalle.precio_unitario) || 0;
    const clienteNombre = this.getClienteServicio(detalle);
    
    // ✅ FILTRAR PAGOS - SOLO por detalle_id
    const pagosFiltrados: any[] = [];
    
    if (this.orden.pagos && this.orden.pagos.length > 0) {
      for (const pago of this.orden.pagos) {
        let detalleIdEncontrado = null;
        let servicioEncontrado = null;
        let clienteEncontrado = null;
        
        // 🔍 Buscar en observaciones
        if (pago.observaciones) {
          try {
            let obs = pago.observaciones;
            if (typeof obs === 'string') {
              obs = JSON.parse(obs);
            }
            
            detalleIdEncontrado = obs.detalle_id || null;
            servicioEncontrado = obs.servicio || null;
            clienteEncontrado = obs.cliente || null;
            
            console.log(`🔍 Analizando pago ID: ${pago.id}`, {
              detalle_id: detalleIdEncontrado,
              servicio: servicioEncontrado,
              cliente: clienteEncontrado,
              monto: pago.monto
            });
          } catch (error) {
            console.warn('⚠️ Error parseando observaciones:', pago.observaciones);
          }
        }
        
        // ✅ SOLO incluir si el detalle_id coincide EXACTAMENTE
        if (detalleIdEncontrado !== null && detalleIdEncontrado === detalle.id) {
          console.log(`✅ Pago ID ${pago.id} agregado por detalle_id`);
          pagosFiltrados.push(pago);
        }
        // 🔍 Si no tiene detalle_id, usar servicio como fallback
        else if (detalleIdEncontrado === null && servicioEncontrado === detalle.servicio?.nombre) {
          console.log(`⚠️ Pago ID ${pago.id} agregado por servicio (fallback)`);
          pagosFiltrados.push(pago);
        }
        // 🔍 Si no tiene detalle_id ni servicio, usar referencia como fallback
        else if (detalleIdEncontrado === null && pago.referencia && pago.referencia.includes(detalle.servicio?.nombre)) {
          console.log(`⚠️ Pago ID ${pago.id} agregado por referencia (fallback)`);
          pagosFiltrados.push(pago);
        } else {
          console.log(`❌ Pago ID ${pago.id} NO coincide`);
        }
      }
    }
    
    console.log('📊 Pagos filtrados:', pagosFiltrados.length);
    pagosFiltrados.forEach((p: any) => {
      let detalleId = 'N/A';
      try {
        if (p.observaciones) {
          const obs = typeof p.observaciones === 'string' ? JSON.parse(p.observaciones) : p.observaciones;
          detalleId = obs.detalle_id || 'N/A';
        }
      } catch {}
      console.log(`  - ID: ${p.id} | Monto: ${p.monto} | detalle_id: ${detalleId}`);
    });
    console.log('🔍 === FIN filtrarOrdenPorServicio ===');
    
    const totalPagadoFiltrado = pagosFiltrados.reduce((sum: number, p: any) => sum + parseFloat(p.monto), 0);
    
    // ✅ Crear orden filtrada
    return {
      ...this.orden,
      detalles: detalleFiltrado,
      total: precioUnitario,
      totalPagado: totalPagadoFiltrado,
      pagos: pagosFiltrados,
      cliente_nombre: clienteNombre,
      doctor: this.orden.doctor
    };
  }


/**
 * ✅ Abre el selector de archivos para un detalle específico
 */
abrirSelectorImagenDetalle(detalle: any, index: number) {
  // Buscar el input correspondiente por índice
  const inputs = this.fileInputsDetalle?.toArray();
  if (inputs && inputs[index]) {
    inputs[index].nativeElement.click();
  } else {
    // Fallback: usar un input temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif';
    input.onchange = (e: any) => {
      if (e.target.files && e.target.files.length > 0) {
        this.procesarImagenDetalle(detalle, index, e.target.files[0]);
      }
    };
    input.click();
  }
}

/**
 * ✅ Procesa la imagen seleccionada para un detalle
 */
procesarImagenDetalle(detalle: any, index: number, file: File) {
  console.log('📁 Imagen seleccionada para detalle:', {
    detalle_id: detalle.id,
    servicio: detalle.servicio?.nombre,
    file: file.name,
    size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
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
  
  this.subirImagenDetalleDesdeDetalle(detalle, index, file);
}

/**
 * ✅ Sube la imagen para un detalle específico
 */
subirImagenDetalleDesdeDetalle(detalle: any, index: number, file: File) {
  if (!detalle.id) {
    Swal.fire('Error', 'No se pudo identificar el detalle', 'error');
    return;
  }
  
  this.detalleSubiendoImagen = index;
  this.subiendoImagen = true;
  
  const formData = new FormData();
  formData.append('imagen', file);
  
  this.subscriptions.push(
    this.ordenService.subirImagenDetalle(detalle.id, file).subscribe({
      next: (response) => {
        this.detalleSubiendoImagen = null;
        this.subiendoImagen = false;
        
        // ✅ Actualizar la URL de la imagen en el detalle
        detalle.imagen_referencia_url = response.imagen_url;
        
        Swal.fire({
          icon: 'success',
          title: '¡Imagen actualizada!',
          timer: 1500,
          showConfirmButton: false
        });
        
        // ✅ Recargar la orden para actualizar la vista
        this.cargarOrden(this.orden.id);
      },
      error: (error) => {
        this.detalleSubiendoImagen = null;
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


/**
 * ✅ Maneja la selección de imagen desde el input oculto
 */
onImagenDetalleSeleccionada(event: Event, index: number) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const detalle = this.orden.detalles[index];
    this.procesarImagenDetalle(detalle, index, input.files[0]);
    input.value = '';
  }
}

/**
 * ✅ Elimina la imagen de un detalle específico
 */
eliminarImagenDetalle(detalle: any, index: number) {
  if (!detalle.id) {
    Swal.fire('Error', 'No se pudo identificar el detalle', 'error');
    return;
  }
  
  if (!detalle.imagen_referencia_url) {
    Swal.fire('Info', 'Este servicio no tiene imagen', 'info');
    return;
  }
  
  Swal.fire({
    title: '¿Eliminar imagen?',
    text: 'Esta acción no se puede deshacer',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#f43f5e'
  }).then((result) => {
    if (result.isConfirmed) {
      this.detalleSubiendoImagen = index;
      this.subiendoImagen = true;
      
      this.subscriptions.push(
        this.ordenService.eliminarImagenDetalle(detalle.id).subscribe({
          next: () => {
            this.detalleSubiendoImagen = null;
            this.subiendoImagen = false;
            
            detalle.imagen_referencia_url = null;
            
            Swal.fire({
              icon: 'success',
              title: 'Imagen eliminada',
              timer: 1500,
              showConfirmButton: false
            });
            
            this.cargarOrden(this.orden.id);
          },
          error: (error) => {
            this.detalleSubiendoImagen = null;
            this.subiendoImagen = false;
            console.error('❌ Error eliminando imagen:', error);
            Swal.fire('Error', 'No se pudo eliminar la imagen', 'error');
          }
        })
      );
    }
  });
}




}