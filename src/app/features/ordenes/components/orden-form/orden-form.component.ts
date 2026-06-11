// orden-form.component.ts - VERSIÓN CORREGIDA
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

  imagenSeleccionada: File | null = null;
  previewUrl: string | null = null;
  subiendoImagen = false;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

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
      prioridad: ['normal'],
      cliente_nombre: [''],
      detalle_cliente: [''],
    });
    
    this.detallesIniciales = [{
      servicio_id: null,
      cantidad: 1,
      precio_unitario: 0,
      subtotal: 0,
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

 // orden-form.component.ts - Modificar el método cargarOrden
cargarOrden() {
  if (!this.ordenId) return;
  
  this.ordenService.getOrden(this.ordenId).subscribe({
    next: (orden) => {
      const totalPagado = orden.pagos?.reduce((sum, pago) => sum + Number(pago.monto), 0) || 0;
      
      console.log('📦 Orden cargada para editar:', orden);
      console.log('📦 Detalles de la orden:', orden.detalles);
      
      if (orden.detalles && orden.detalles.length > 0) {
        // ✅ Mapear correctamente los detalles
        this.detallesIniciales = orden.detalles.map((det: any) => ({
          id: det.id,
          servicio_id: det.servicio_id,
          servicio_nombre: det.servicio?.nombre || '',
          cantidad: det.cantidad || 1,
          precio_unitario: det.precio_unitario || 0,
          subtotal: (det.cantidad || 1) * (det.precio_unitario || 0),
          fecha_limite: det.fecha_limite || '',
          hora_limite: det.hora_limite || ''
        }));
        
        console.log('✅ Detalles mapeados:', this.detallesIniciales);
      } else {
        this.detallesIniciales = [{
          servicio_id: null,
          cantidad: 1,
          precio_unitario: 0,
          subtotal: 0,
          fecha_limite: '',
          hora_limite: ''
        }];
      }
      
      this.ordenForm.patchValue({
        doctor_id: orden.doctor_id,
        total: orden.total,
        pago_inicial: totalPagado,
        prioridad: orden.prioridad,
        cliente_nombre: orden.cliente_nombre,
        detalle_cliente: orden.detalle_cliente
      });
      
      if (orden.imagen_referencia_url) {
        const imagenesUrl = environment.baseUrl.replace(/\/+$/, '');
        this.previewUrl = `${imagenesUrl}${orden.imagen_referencia_url}`;
      }
      
      // ✅ Forzar actualización del componente hijo
      setTimeout(() => {
        this.cdr.detectChanges();
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
        Swal.fire({
          icon: 'error',
          title: 'Imagen muy grande',
          text: `La imagen no puede superar los 10MB.`,
          confirmButtonColor: '#f43f5e'
        });
        this.fileInput.nativeElement.value = '';
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        Swal.fire({
          icon: 'error',
          title: 'Formato no soportado',
          text: 'Formatos permitidos: JPG, JPEG, PNG, GIF, WEBP',
          confirmButtonColor: '#f43f5e'
        });
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

  // ✅ MÉTODO onSubmit CORREGIDO
  onSubmit() {
    // Validar que haya al menos un detalle válido
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
    
    // Preparar datos para enviar al backend
    const datosParaEnviar = {
      doctor_id: formValue.doctor_id,
      detalles: detallesValidos.map((d: any) => ({
        servicio_id: d.servicio_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        fecha_limite: d.fecha_limite || null,
        hora_limite: d.hora_limite || null
      })),
      pago_inicial: formValue.pago_inicial || 0,
      prioridad: formValue.prioridad,
      cliente_nombre: formValue.cliente_nombre || null,
      detalle_cliente: formValue.detalle_cliente || null
    };
    
    // Log para depuración
    console.log('📤 Enviando orden:', JSON.stringify(datosParaEnviar, null, 2));
    
    this.subiendoImagen = true;
    
    if (this.esEdicion && this.ordenId) {
      // ACTUALIZAR ORDEN
      this.ordenService.actualizarOrden(this.ordenId, datosParaEnviar).subscribe({
        next: (respuesta: any) => {
          this.subiendoImagen = false;
          Swal.fire('¡Éxito!', 'Orden actualizada correctamente', 'success');
          this.router.navigate(['/ordenes', this.ordenId]);
        },
        error: (error: any) => {
          this.subiendoImagen = false;
          console.error('Error actualizando orden:', error);
          if (error.error && error.error.error) {
            Swal.fire('Error', error.error.error, 'error');
          } else {
            Swal.fire('Error', 'No se pudo actualizar la orden', 'error');
          }
        }
      });
    } else {
      // CREAR NUEVA ORDEN
      this.ordenService.crearOrden(datosParaEnviar).subscribe({
        next: (respuesta: any) => {
          this.subiendoImagen = false;
          Swal.fire('¡Éxito!', 'Orden creada correctamente', 'success');
          this.router.navigate(['/ordenes']);
        },
        error: (error: any) => {
          this.subiendoImagen = false;
          console.error('Error creando orden:', error);
          // Mostrar mensaje de error detallado
          if (error.error && error.error.error) {
            Swal.fire('Error', error.error.error, 'error');
          } else if (error.error && error.error.details) {
            Swal.fire('Error', error.error.details, 'error');
          } else {
            Swal.fire('Error', 'No se pudo crear la orden', 'error');
          }
        }
      });
    }
  }

  onDetallesChange(detalles: any[]) {
    this.detallesIniciales = detalles;
  }
  
  onTotalChange(total: number) {
    this.ordenForm.patchValue({ total: total });
  }
}