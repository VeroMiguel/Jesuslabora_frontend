// orden-form.component.ts - VERSIÓN COMPLETA CORREGIDA
import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrdenService } from '../../../../core/services/orden.service';
import { DoctorService } from '../../../../core/services/doctor.service';
import { ServicioService } from '../../../../core/services/servicio.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfigService } from '../../../../core/services/config.service';
import Swal from 'sweetalert2';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { environment } from '../../../../../environments/environment';
import { MultiServicioSelectorComponent } from '../multi-servicio-selector/multi-servicio-selector.component';

@Component({
  selector: 'app-orden-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SearchableSelectComponent, MultiServicioSelectorComponent],
  templateUrl: './orden-form.component.html',
  styleUrls: ['./orden-form.component.css']
})
export class OrdenFormComponent implements OnInit {
  ordenForm: FormGroup;
  doctores: any[] = [];
  servicios: any[] = [];
  detallesIniciales: any[] = [];
  esEdicion = false;
  ordenId?: number;
  tipoCliente: 'unico' | 'multiple' = 'unico';
  clienteGlobal = { nombre: '', detalle: '' };

  imagenSeleccionada: File | null = null;
  previewUrl: string | null = null;
  subiendoImagen = false;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild(MultiServicioSelectorComponent) multiServicioSelector!: MultiServicioSelectorComponent;

  constructor(
    private fb: FormBuilder,
    private ordenService: OrdenService,
    private doctorService: DoctorService,
    private servicioService: ServicioService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef
  ) {
    this.ordenForm = this.fb.group({
      doctor_id: ['', Validators.required],
      total: ['', [Validators.required, Validators.min(0)]],
      pago_inicial: [0, [Validators.min(0)]],
      prioridad: ['normal']
    });
    
    this.detallesIniciales = [{
      servicio_id: null,
      precio_unitario: 0,
      fecha_limite: '',
      hora_limite: ''
    }];
  }

  ngOnInit() {
    this.cargarDoctores();
    this.cargarServicios();

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.esEdicion = true;
        this.ordenId = +params['id'];
        this.cargarOrdenCuandoListo();
      }
    });
  }

  private cargarOrdenCuandoListo() {
    const intervalId = setInterval(() => {
      if (this.doctores.length > 0 && this.servicios.length > 0) {
        clearInterval(intervalId);
        this.cargarOrden();
      }
    }, 100);
    
    setTimeout(() => {
      clearInterval(intervalId);
      if (this.doctores.length === 0 || this.servicios.length === 0) {
        this.cargarOrden();
      }
    }, 5000);
  }

  cargarDoctores() {
    this.doctorService.getDoctores().subscribe({
      next: (data) => {
        this.doctores = data;
        console.log('📋 Doctores cargados:', this.doctores.length);
      },
      error: (error) => console.error('Error cargando doctores:', error)
    });
  }

  cargarServicios() {
    this.servicioService.getServicios().subscribe({
      next: (data) => {
        this.servicios = data;
        console.log('📋 Servicios cargados:', this.servicios.length);
      },
      error: (error) => console.error('Error cargando servicios:', error)
    });
  }

 // orden-form.component.ts - MODIFICAR cargarOrden()
// orden-form.component.ts - MODIFICAR cargarOrden()
cargarOrden() {
  if (!this.ordenId) return;
  
  this.ordenService.getOrden(this.ordenId).subscribe({
    next: (orden) => {
      const totalPagado = orden.pagos?.reduce((sum, pago) => sum + Number(pago.monto), 0) || 0;
      
      // ✅ Cargar cliente global si existe en la orden
      if (orden.cliente_nombre) {
        this.clienteGlobal = {
          nombre: orden.cliente_nombre,
          detalle: orden.detalle_cliente || ''
        };
        this.tipoCliente = 'unico';
      } 
      else if (orden.detalles?.some((d: any) => d.cliente_nombre)) {
        this.tipoCliente = 'multiple';
        this.clienteGlobal = { nombre: '', detalle: '' };
      }
      
      if (orden.detalles && orden.detalles.length > 0) {
        this.detallesIniciales = orden.detalles.map((det: any) => {
          // ✅ IMPORTANTE: Convertir la URL a preview usando el pipe
          let previewUrl = det.imagen_referencia_url;
          if (previewUrl && !previewUrl.startsWith('http') && !previewUrl.startsWith('data:')) {
            const baseUrl = environment.apiUrl.replace('/api', '');
            previewUrl = `${baseUrl}${previewUrl}`;
          }
          
          return {
            id: det.id,
            servicio_id: det.servicio_id,
            servicio_nombre: det.servicio?.nombre || '',
            precio_unitario: Number(det.precio_unitario) || 0,
            fecha_limite: det.fecha_limite || '',
            hora_limite: det.hora_limite || '',
            cliente_nombre: det.cliente_nombre || '',
            detalle_cliente: det.detalle_cliente || '',
            imagen_url: det.imagen_referencia_url || '',
            imagen_preview: previewUrl  // ← Usar URL completa
          };
        });
      }
      
      this.ordenForm.patchValue({
        doctor_id: orden.doctor_id,
        total: orden.total,
        pago_inicial: totalPagado,
        prioridad: orden.prioridad
      });
      
      setTimeout(() => {
        this.cdr.detectChanges();
        if (this.multiServicioSelector) {
          this.multiServicioSelector.tipoCliente = this.tipoCliente;
          this.multiServicioSelector.clienteUnico = { ...this.clienteGlobal };
        }
      }, 100);
    },
    error: (error) => {
      console.error('Error cargando orden:', error);
      Swal.fire('Error', 'No se pudo cargar la orden', 'error');
    }
  });
}
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        Swal.fire({ icon: 'error', title: 'Imagen muy grande', text: 'La imagen no puede superar los 10MB.', confirmButtonColor: '#f43f5e' });
        this.fileInput.nativeElement.value = '';
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        Swal.fire({ icon: 'error', title: 'Formato no soportado', text: 'Formatos permitidos: JPG, JPEG, PNG, GIF, WEBP', confirmButtonColor: '#f43f5e' });
        this.fileInput.nativeElement.value = '';
        return;
      }

      this.imagenSeleccionada = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removerImagen() {
    this.imagenSeleccionada = null;
    this.previewUrl = null;
  }

 // orden-form.component.ts - MODIFICAR onSubmit()
async onSubmit() {
    const detallesValidos = this.detallesIniciales.filter(d => d.servicio_id && d.precio_unitario > 0);
    
    if (detallesValidos.length === 0) {
        Swal.fire('Error', 'Debe agregar al menos un servicio válido', 'error');
        return;
    }
    
    if (!this.ordenForm.valid) {
        Swal.fire('Error', 'Por favor complete todos los campos requeridos', 'error');
        return;
    }
    
    const formValue = this.ordenForm.value;
    const clienteGlobal = this.multiServicioSelector?.clienteUnico || { nombre: '', detalle: '' };
    
    // ✅ Incluir imagen_url existente en los detalles
    const datosParaEnviar = {
        doctor_id: formValue.doctor_id,
        detalles: detallesValidos.map((d: any) => ({
            servicio_id: d.servicio_id,
            precio_unitario: Number(d.precio_unitario),
            fecha_limite: d.fecha_limite || null,
            hora_limite: d.hora_limite || null,
            cliente_nombre: this.tipoCliente === 'multiple' ? (d.cliente_nombre || null) : null,
            detalle_cliente: this.tipoCliente === 'multiple' ? (d.detalle_cliente || null) : null,
            imagen_referencia_url: d.imagen_url || null  // ✅ Enviar URL existente
        })),
        pago_inicial: Number(formValue.pago_inicial) || 0,
        prioridad: formValue.prioridad,
        cliente_nombre: this.tipoCliente === 'unico' ? (clienteGlobal.nombre || null) : null,
        detalle_cliente: this.tipoCliente === 'unico' ? (clienteGlobal.detalle || null) : null
    };
    
    console.log('📤 Enviando orden:', JSON.stringify(datosParaEnviar, null, 2));
    
    this.subiendoImagen = true;
    
    const ordenServiceMethod = this.esEdicion && this.ordenId 
        ? this.ordenService.actualizarOrden(this.ordenId, datosParaEnviar)
        : this.ordenService.crearOrden(datosParaEnviar);
    
    ordenServiceMethod.subscribe({
        next: async (respuesta: any) => {
            const ordenCreada = respuesta.orden || respuesta;
            const ordenId = ordenCreada.id;
            
            // ✅ Subir NUEVAS imágenes (solo las que son archivos nuevos)
            if (ordenId && this.detallesIniciales) {
                for (let i = 0; i < this.detallesIniciales.length; i++) {
                    const detalle = this.detallesIniciales[i];
                    // ✅ Solo subir si es un archivo NUEVO (no una URL existente)
                    if (detalle.imagen_file && ordenCreada.detalles && ordenCreada.detalles[i]) {
                        const detalleId = ordenCreada.detalles[i].id;
                        await this.subirImagenDetalle(detalleId, detalle.imagen_file);
                    }
                }
            }
            
            this.subiendoImagen = false;
            Swal.fire('¡Éxito!', `Orden ${this.esEdicion ? 'actualizada' : 'creada'} correctamente`, 'success');
            this.router.navigate(['/ordenes']);
        },
        error: (error: any) => {
            this.subiendoImagen = false;
            console.error('Error:', error);
            Swal.fire('Error', error.error?.error || error.error?.details || 'No se pudo procesar la orden', 'error');
        }
    });
}

  async subirImagenDetalle(detalleId: number, file: File): Promise<void> {
    try {
      await this.ordenService.subirImagenDetalle(detalleId, file).toPromise();
      console.log(`✅ Imagen subida para detalle ${detalleId}`);
    } catch (error) {
      console.error(`❌ Error subiendo imagen para detalle ${detalleId}:`, error);
    }
  }

  onDetallesChange(detalles: any[]) {
    this.detallesIniciales = detalles;
  }
  
  onTotalChange(total: number) {
    this.ordenForm.patchValue({ total: total });
  }

  onClienteGlobalChange(cliente: { nombre: string; detalle: string }) {
    this.clienteGlobal = cliente;
  }

  onTipoClienteChange(tipo: 'unico' | 'multiple') {
    this.tipoCliente = tipo;
  }
}