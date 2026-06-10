// orden-form.component.ts
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
@Component({
  selector: 'app-orden-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SearchableSelectComponent],
  templateUrl: './orden-form.component.html',
  styleUrls: ['./orden-form.component.css']
})
export class OrdenFormComponent implements OnInit {
  ordenForm: FormGroup;
  doctores: any[] = [];
  servicios: any[] = [];
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
    private cdr: ChangeDetectorRef  // ✅ AGREGAR ESTO
  ) {
    this.ordenForm = this.fb.group({
      doctor_id: ['', Validators.required],
      servicio_id: ['', Validators.required],
      total: ['', [Validators.required, Validators.min(0)]],
      pago_inicial: [0, [Validators.min(0)]],
      prioridad: ['normal'],
      fecha_limite: [''],
      hora_limite: [''],
      cliente_nombre: [''],
      detalle_cliente: [''],
    });
  }

ngOnInit() {
  // ✅ PRIMERO: Cargar doctores y servicios
  this.cargarDoctores();
  this.cargarServicios();

    // ✅ Agregar el listener después de que los servicios estén cargados
  // Pero esperar a que servicios estén listos
  const checkInterval = setInterval(() => {
    if (this.servicios.length > 0) {
      clearInterval(checkInterval);
      this.setupServicioListener();
    }
  }, 100);

  this.route.params.subscribe(params => {
    if (params['id']) {
      this.esEdicion = true;
      this.ordenId = +params['id'];
      // ✅ ESPERAR a que se carguen doctores y servicios antes de cargar la orden
      this.cargarOrdenCuandoListo();
    }
  });
}

// ✅ Nuevo método: Esperar a que doctores y servicios estén listos
private cargarOrdenCuandoListo() {
  // Verificar cada 500ms si doctores y servicios están cargados
  const intervalId = setInterval(() => {
    if (this.doctores.length > 0 && this.servicios.length > 0) {
      clearInterval(intervalId);
      console.log('✅ Doctores y servicios cargados, procediendo a cargar orden...');
      this.cargarOrden();
    }
  }, 100);
  
  // Timeout después de 5 segundos para no quedar en loop infinito
  setTimeout(() => {
    clearInterval(intervalId);
    if (this.doctores.length === 0 || this.servicios.length === 0) {
      console.error('❌ Timeout cargando doctores/servicios');
      this.cargarOrden(); // Intentar cargar igualmente
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


// Método para manejar la selección de servicio
onServicioSeleccionado(servicio: any) {
  if (servicio && servicio.precio_referencial) {
    // Si el servicio tiene precio referencial, actualizar el campo total
    this.ordenForm.patchValue({
      total: servicio.precio_referencial
    });
    console.log(`💰 Precio referencial cargado: ${servicio.precio_referencial}`);
  }
}

// ✅ OPCIONAL: Escuchar cambios en el servicio (para nueva orden)
private setupServicioListener() {
  this.ordenForm.get('servicio_id')?.valueChanges.subscribe(servicioId => {
    if (servicioId && !this.esEdicion) {
      const servicio = this.servicios.find(s => s.id === servicioId);
      if (servicio && servicio.precio_referencial) {
        this.ordenForm.patchValue({
          total: servicio.precio_referencial
        });
      }
    }
  });
}









// orden-form.component.ts - Reemplazar el método cargarOrden()

cargarOrden() {
  if (!this.ordenId) return;
  
  this.ordenService.getOrden(this.ordenId).subscribe({
    next: (orden) => {
      const totalPagado = orden.pagos?.reduce((sum, pago) => sum + Number(pago.monto), 0) || 0;
      
      // ✅ CORREGIDO: Manejo correcto de fechas sin desfase
      let fechaLimiteFormateada = '';
      if (orden.fecha_limite) {
        // La fecha viene como YYYY-MM-DD del backend
        // NO aplicar conversión de zona horaria, usarla directamente
        fechaLimiteFormateada = orden.fecha_limite; // Ya viene en formato YYYY-MM-DD
      }
      
      // ✅ Asegurar que hora_limite tenga formato HH:MM
      let horaFormateada = orden.hora_limite || '';
      if (horaFormateada && horaFormateada.includes(':')) {
        // Si viene con segundos, solo tomar HH:MM
        horaFormateada = horaFormateada.substring(0, 5);
      }
      
      this.ordenForm.patchValue({
        doctor_id: orden.doctor_id,
        servicio_id: orden.servicio_id,
        total: orden.total,
        pago_inicial: totalPagado,
        prioridad: orden.prioridad,
        fecha_limite: fechaLimiteFormateada,
        hora_limite: horaFormateada,
        cliente_nombre: orden.cliente_nombre,
        detalle_cliente: orden.detalle_cliente
      });

      // Cargar la imagen de referencia existente
      if (orden.imagen_referencia_url) {
        const imagenesUrl = environment.baseUrl.replace(/\/+$/, '');
        this.previewUrl = `${imagenesUrl}${orden.imagen_referencia_url}`;
      }
      
      this.cdr.detectChanges();
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
      console.log('📁 Archivo seleccionado:', {
        nombre: file.name,
        tamaño: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        tipo: file.type
      });
      
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        Swal.fire({
          icon: 'error',
          title: 'Imagen muy grande',
          text: `La imagen no puede superar los 10MB. Actualmente pesa ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
          confirmButtonColor: '#f43f5e'
        });
        this.fileInput.nativeElement.value = '';
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


  private formatearFechaParaBackend(fecha: string): string {
    if (!fecha) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    const date = new Date(fecha);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ✅ Método auxiliar para obtener el valor seguro de un control
  private getControlValue(controlName: string): any {
    const control = this.ordenForm.get(controlName);
    return control ? control.value : null;
  }

  // ✅ También modifica el método onSubmit para asegurar que la imagen se actualice correctamente
  // orden-form.component.ts - Reemplazar el método onSubmit() completo

async onSubmit() {  // ✅ AGREGAR 'async' aquí
  if (this.ordenForm.valid) {
    const formValue = { ...this.ordenForm.value };
    
    if (formValue.fecha_limite) {
      formValue.fecha_limite = this.formatearFechaParaBackend(formValue.fecha_limite);
    } else {
      formValue.fecha_limite = null;
      formValue.hora_limite = null;
    }
    
    if (formValue.pago_inicial === '' || formValue.pago_inicial === null) {
      formValue.pago_inicial = 0;
    }
    
    if (this.esEdicion && this.ordenId) {
      // ACTUALIZAR ORDEN
      const updateData = { ...formValue };
      
      // ✅ CORREGIDO: Obtener orden original SIN await (usar toPromise con async/await funciona porque el método es async)
      let ordenOriginal = null;
      try {
        ordenOriginal = await this.ordenService.getOrden(this.ordenId).toPromise();
      } catch (err) {
        console.warn('No se pudo obtener orden original:', err);
      }
      
      const fechaOriginal = ordenOriginal?.fecha_limite || '';
      const horaOriginal = ordenOriginal?.hora_limite || '';
      const fechaNueva = updateData.fecha_limite || '';
      const horaNueva = updateData.hora_limite || '';
      
      const fechaCambio = fechaOriginal !== fechaNueva || horaOriginal !== horaNueva;
      
      if (this.imagenSeleccionada) {
        const formData = new FormData();
        Object.keys(updateData).forEach(key => {
          if (updateData[key] !== null && updateData[key] !== undefined && updateData[key] !== '') {
            formData.append(key, String(updateData[key]));
          }
        });
        formData.append('imagen_referencia', this.imagenSeleccionada);
        
        this.subiendoImagen = true;
        this.ordenService.actualizarOrdenConImagen(this.ordenId, formData).subscribe({
          next: async (respuesta: any) => {
            this.subiendoImagen = false;
            
            if (fechaCambio && respuesta.orden) {
              console.log('🔄 Fecha límite modificada, reprogramando notificaciones...');
              await this.reprogramarNotificaciones(respuesta.orden);
            }
            
            Swal.fire('¡Éxito!', 'Orden actualizada correctamente', 'success');
            this.router.navigate(['/ordenes', this.ordenId]);
          },
          error: (error: any) => {
            this.subiendoImagen = false;
            console.error('Error actualizando orden:', error);
            Swal.fire('Error', 'No se pudo actualizar la orden', 'error');
          }
        });
      } else {
        this.subiendoImagen = true;
        this.ordenService.actualizarOrden(this.ordenId, updateData).subscribe({
          next: async (respuesta: any) => {
            this.subiendoImagen = false;
            
            if (fechaCambio && respuesta.orden) {
              console.log('🔄 Fecha límite modificada, reprogramando notificaciones...');
              await this.reprogramarNotificaciones(respuesta.orden);
            }
            
            Swal.fire('¡Éxito!', 'Orden actualizada correctamente', 'success');
            this.router.navigate(['/ordenes', this.ordenId]);
          },
          error: (error: any) => {
            this.subiendoImagen = false;
            console.error('Error actualizando orden:', error);
            Swal.fire('Error', 'No se pudo actualizar la orden', 'error');
          }
        });
      }
    } else {
      // CREAR NUEVA ORDEN
      const formData = new FormData();
      Object.keys(formValue).forEach(key => {
        if (formValue[key] !== null && formValue[key] !== undefined && formValue[key] !== '') {
          formData.append(key, formValue[key]);
        }
      });

      if (this.imagenSeleccionada) {
        formData.append('imagen_referencia', this.imagenSeleccionada);
      }

      this.ordenService.crearOrdenConImagen(formData).subscribe({
        next: (respuesta: any) => {
          this.subiendoImagen = false;
          
          let ordenCreada = respuesta.orden;
          
          if (!ordenCreada && respuesta.mensaje) {
            console.warn('⚠️ Backend no devolvió orden completa, construyendo manualmente...');
            
            const doctorId = this.getControlValue('doctor_id');
            const servicioId = this.getControlValue('servicio_id');
            
            ordenCreada = {
              id: 'nueva',
              id_externo: `ORD-${Date.now()}`,
              doctor: this.doctores.find(d => d && d.id == doctorId) || null,
              servicio: this.servicios.find(s => s && s.id == servicioId) || null,
              fecha_limite: formValue.fecha_limite,
              hora_limite: formValue.hora_limite,
              cliente_nombre: formValue.cliente_nombre,
              total: formValue.total
            };
          }
          
          this.programarNotificacionSiCorresponde(ordenCreada || formValue);
          Swal.fire('¡Éxito!', 'Orden creada correctamente', 'success');
          this.router.navigate(['/ordenes']);
        },
        error: (error: any) => {
          this.subiendoImagen = false;
          console.error('Error creando orden:', error);
          Swal.fire('Error', 'No se pudo crear la orden', 'error');
        }
      });
    }
  } else {
    Object.keys(this.ordenForm.controls).forEach(key => {
      const control = this.ordenForm.get(key);
      if (control?.invalid) {
        console.log(`Campo inválido: ${key}`, control.errors);
      }
    });
    Swal.fire('Error', 'Por favor complete todos los campos requeridos', 'error');
  }
}

// orden-form.component.ts - Reemplazar el método programarNotificacionSiCorresponde()

private async programarNotificacionSiCorresponde(orden: any): Promise<void> {
  console.log('🔔 [DEBUG] programarNotificacionSiCorresponde llamado con:', orden);
  
  if (!orden?.fecha_limite) {
    console.log('⚠️ Orden sin fecha límite, no se programan notificaciones');
    return;
  }

  console.log(`📅 Fecha límite: ${orden.fecha_limite}, Hora: ${orden.hora_limite}`);

  const tienePermiso = await this.notificationService.solicitarPermiso();
  console.log(`📢 ¿Tiene permiso? ${tienePermiso}`);
  
  if (!tienePermiso) {
    console.warn('⚠️ Sin permiso para notificaciones');
    Swal.fire({
      icon: 'warning',
      title: 'Notificaciones bloqueadas',
      html: `Para recibir alertas en tu celular, permite las notificaciones en la configuración del navegador.`,
      confirmButtonColor: '#6366f1'
    });
    return;
  }

  // ✅ CORREGIDO: Asegurar valores string
  const resultado = await this.notificationService.programarNotificacionOrden({
    id: orden.id ?? orden.id_externo ?? 'nueva',
    id_externo: orden.id_externo ?? `#${orden.id}`,
    fecha_limite: orden.fecha_limite || '',
    hora_limite: orden.hora_limite || '',
    doctor: orden.doctor,
    servicio: orden.servicio,
    cliente_nombre: orden.cliente_nombre || ''
  });

  console.log('📊 Resultado programación:', resultado);

  if (resultado.programadas > 0) {
    console.log(`🔔 ${resultado.mensaje}`);
    
    const minutos = this.configService.config.tiempoNotificacionAnticipada;
    const anticipacionTexto = minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h`;

    const Toast = Swal.mixin({
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true
    });
    Toast.fire({
      icon: 'success',
      title: '🔔 Notificaciones programadas',
      html: resultado.programadas === 2
        ? `A la hora exacta y <strong>${anticipacionTexto} antes</strong>`
        : resultado.mensaje
    });
  }
}
// orden-form.component.ts - Agregar este método

// orden-form.component.ts - Reemplazar el método reprogramarNotificaciones()

private async reprogramarNotificaciones(ordenActualizada: any): Promise<void> {
  try {
    // Obtener la orden completa con relaciones
    const ordenCompleta = await this.ordenService.getOrden(ordenActualizada.id).toPromise();
    
    if (!ordenCompleta) return;
    
    // ✅ CORREGIDO: Asegurar que fecha_limite sea string
    const fechaLimite = ordenCompleta.fecha_limite || '';
    const horaLimite = ordenCompleta.hora_limite || '';
    
    // Programar nuevas notificaciones
    await this.notificationService.programarNotificacionOrden({
      id: ordenCompleta.id,
      id_externo: ordenCompleta.id_externo,
      fecha_limite: fechaLimite,  // ✅ Ahora es string, no undefined
      hora_limite: horaLimite,     // ✅ Ahora es string, no undefined
      doctor: ordenCompleta.doctor,
      servicio: ordenCompleta.servicio,
      cliente_nombre: ordenCompleta.cliente_nombre || ''
    });
    
    console.log(`✅ Notificaciones reprogramadas para orden ${ordenCompleta.id_externo}`);
  } catch (error) {
    console.error('Error reprogramando notificaciones:', error);
  }
}
}