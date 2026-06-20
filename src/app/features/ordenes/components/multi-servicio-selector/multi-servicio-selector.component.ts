// multi-servicio-selector.component.ts - VERSIÓN ULTRA COMPACTA
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServicioService } from '../../../../core/services/servicio.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { environment } from 'src/environments/environment';
import Swal from 'sweetalert2';
import { ImagenPipe } from '../../../../shared/pipes/imagen.pipe';

export interface DetalleServicio {
  id?: number;
  servicio_id: number | null;
  servicio_nombre?: string;
  precio_unitario: number;
  fecha_limite: string;
  hora_limite: string;
  cliente_nombre?: string;
  detalle_cliente?: string;
  imagen_url?: string;
  imagen_nombre?: string;
  imagen_preview?: string;
  imagen_file?: File;
  pago_inicial?: number; // ✅ NUEVO
}

@Component({
  selector: 'app-multi-servicio-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, MonedaPipe, ImagenPipe,],
  templateUrl: './multi-servicio-selector.component.html',
  styleUrls: ['./multi-servicio-selector.component.css']
})
export class MultiServicioSelectorComponent implements OnInit, OnChanges {
  @Input() serviciosDisponibles: any[] = [];
  @Input() detallesIniciales: DetalleServicio[] = [];
  @Input() clienteGlobal: { nombre: string; detalle: string } = { nombre: '', detalle: '' };
    // multi-servicio-selector.component.ts - AGREGAR ESTO
@Input() tipoCliente: 'unico' | 'multiple' = 'unico';
  @Output() detallesChange = new EventEmitter<DetalleServicio[]>();
  @Output() totalChange = new EventEmitter<number>();
  @Output() clienteGlobalChange = new EventEmitter<{ nombre: string; detalle: string }>();
  // multi-servicio-selector.component.ts - AGREGAR ESTOS OUTPUTS
  @Output() tipoClienteChange = new EventEmitter<'unico' | 'multiple'>();


  detalles: DetalleServicio[] = [];
  totalGeneral: number = 0;
  expandidos: { [key: number]: boolean } = {};

  clienteUnico = { nombre: '', detalle: '' };
  
  indicesActivos: { [key: number]: boolean } = {};
  busquedaPorIndice: { [key: number]: string } = {};
  serviciosFiltradosPorIndice: { [key: number]: any[] } = {};


   // ✅ Guardar copia de los clientes por servicio originales
  private clientesOriginales: { [key: number]: { cliente_nombre?: string; detalle_cliente?: string } } = {};
  
  constructor(private servicioService: ServicioService,
  private cdr: ChangeDetectorRef) {}
  private _focusTimeout: any = null;
  ngOnInit() {
    this.cargarServicios();
    this.inicializarDetalles();
  }
  
// multi-servicio-selector.component.ts - AGREGAR ngOnChanges para sincronizar
// multi-servicio-selector.component.ts - MODIFICAR ngOnChanges
ngOnChanges(changes: SimpleChanges) {
  if (changes['detallesIniciales']?.currentValue) {
    this.detalles = [...changes['detallesIniciales'].currentValue];
    // ✅ Guardar copia de los clientes originales
    this.detalles.forEach((d, i) => {
      if (d.cliente_nombre || d.detalle_cliente) {
        this.clientesOriginales[i] = {
          cliente_nombre: d.cliente_nombre,
          detalle_cliente: d.detalle_cliente
        };
      }
    });
    this.calcularTotal();
  }
  if (changes['clienteGlobal']?.currentValue) {
    this.clienteUnico = { ...changes['clienteGlobal'].currentValue };
  }
  if (changes['tipoCliente']?.currentValue !== undefined) {
    this.tipoCliente = changes['tipoCliente'].currentValue;
  }
}
  
// MODIFICAR onTipoClienteChange
  onTipoClienteChange() {
    if (this.tipoCliente === 'unico') {
      // ✅ Guardar copia de los clientes por servicio ANTES de limpiar
      this.detalles.forEach((d, i) => {
        if (d.cliente_nombre || d.detalle_cliente) {
          this.clientesOriginales[i] = {
            cliente_nombre: d.cliente_nombre,
            detalle_cliente: d.detalle_cliente
          };
        }
      });
      // Limpiar clientes por servicio
      this.detalles.forEach(d => {
        d.cliente_nombre = undefined;
        d.detalle_cliente = undefined;
      });
    } else {
      // ✅ Restaurar clientes por servicio desde la copia guardada
      this.detalles.forEach((d, i) => {
        if (this.clientesOriginales[i]) {
          d.cliente_nombre = this.clientesOriginales[i].cliente_nombre;
          d.detalle_cliente = this.clientesOriginales[i].detalle_cliente;
        }
      });
    }
    this.tipoClienteChange.emit(this.tipoCliente);
    this.emitirCambios();
  }

  
  private inicializarDetalles() {
    if (this.detallesIniciales && this.detallesIniciales.length > 0) {
      this.detalles = [...this.detallesIniciales];
    } else {
      this.agregarDetalle();
    }
    this.calcularTotal();
    if (this.detalles.length > 0) this.expandidos[0] = true;
  }
  
  private cargarServicios() {
    if (this.serviciosDisponibles.length === 0) {
      this.servicioService.getServicios().subscribe({
        next: (data) => this.serviciosDisponibles = data
      });
    }
  }
  
  toggleExpandir(index: number) {
    this.expandidos[index] = !this.expandidos[index];
  }
  
// ✅ MODIFICAR: toggleDropdown - Abrir siempre con opciones
// En toggleDropdown() - Línea ~120
toggleDropdown(index: number) {
  console.log('🔽 [MultiServicio] toggleDropdown - índice:', index, 'activo:', this.indicesActivos[index]);
  
  if (!this.indicesActivos[index]) {
    this.indicesActivos[index] = true;
    this.serviciosFiltradosPorIndice[index] = [...this.serviciosDisponibles];
    this.busquedaPorIndice[index] = '';
    console.log('🔽 [MultiServicio] toggleDropdown - ABRIENDO, servicios disponibles:', this.serviciosDisponibles.length);
    this.cdr?.detectChanges();
  } else {
    this.indicesActivos[index] = false;
    console.log('🔽 [MultiServicio] toggleDropdown - CERRANDO');
  }
}

  
// ✅ MODIFICAR: filtrarServicios - Mostrar resultados solo si hay búsqueda
// En filtrarServicios() - Línea ~135
filtrarServicios(index: number, busqueda: string) {
  console.log('🔍 [MultiServicio] filtrarServicios - índice:', index, 'búsqueda:', `"${busqueda}"`);
  
  this.busquedaPorIndice[index] = busqueda;
  
  if (!busqueda || busqueda.trim() === '') {
    this.serviciosFiltradosPorIndice[index] = [...this.serviciosDisponibles];
    console.log('🔍 [MultiServicio] filtrarServicios - SIN FILTRO, total:', this.serviciosFiltradosPorIndice[index].length);
    return;
  }
  
  const busquedaLower = busqueda.toLowerCase().trim();
  this.serviciosFiltradosPorIndice[index] = this.serviciosDisponibles
    .filter(s => s.nombre.toLowerCase().includes(busquedaLower))
    .slice(0, 15);
  console.log('🔍 [MultiServicio] filtrarServicios - RESULTADOS:', this.serviciosFiltradosPorIndice[index].length);
}
  
// ✅ NUEVO: Método para manejar focus en el campo de búsqueda
// En onServicioFocus() - Línea ~145
// MODIFICAR: onServicioFocus()
onServicioFocus(index: number) {
  console.log('🎯 [MultiServicio] onServicioFocus - índice:', index, 'activo:', this.indicesActivos[index]);
  
  // ✅ Limpiar timeout anterior
  if (this._focusTimeout) {
    clearTimeout(this._focusTimeout);
    this._focusTimeout = null;
  }
  
  // ✅ Solo abrir si está cerrado
  if (!this.indicesActivos[index]) {
    this.indicesActivos[index] = true;
    this.serviciosFiltradosPorIndice[index] = [...this.serviciosDisponibles];
    console.log('🎯 [MultiServicio] onServicioFocus - ABRIENDO por focus, servicios:', this.serviciosDisponibles.length);
    
    if (this.busquedaPorIndice[index]) {
      this.filtrarServicios(index, this.busquedaPorIndice[index]);
    }
    this.cdr?.detectChanges();
  }
}


// ✅ NUEVO: Cerrar dropdown al hacer clic fuera
@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const wrapper = target.closest('.servicio-selector-wrapper');
  
  // ✅ Si el clic fue fuera del wrapper, cerrar todos los dropdowns
  if (!wrapper) {
    Object.keys(this.indicesActivos).forEach(key => {
      this.indicesActivos[parseInt(key)] = false;
    });
    this.cdr?.detectChanges();
  }
}






// También corregir cuando se selecciona servicio
// ✅ MODIFICAR: seleccionarServicio - Cerrar dropdown y limpiar búsqueda
// En seleccionarServicio() - Línea ~155
seleccionarServicio(index: number, servicio: any) {
  console.log('✅ [MultiServicio] seleccionarServicio - índice:', index, 'servicio:', servicio.nombre);
  
  this.detalles[index].servicio_id = servicio.id;
  this.detalles[index].servicio_nombre = servicio.nombre;
  this.detalles[index].precio_unitario = Number(servicio.precio_referencial) || 0;
  
  this.indicesActivos[index] = false;
  this.busquedaPorIndice[index] = '';
  this.serviciosFiltradosPorIndice[index] = [];
  
  this.calcularTotal();
  this.emitirCambios();
  console.log('✅ [MultiServicio] seleccionarServicio - COMPLETADO');
}
  
// multi-servicio-selector.component.ts - MODIFICAR agregarDetalle
agregarDetalle() {
  const nuevoIndex = this.detalles.length;
  this.detalles.push({
    servicio_id: null,
    precio_unitario: 0,
    fecha_limite: '',
    hora_limite: ''
  });
  // ✅ Inicializar entrada en clientesOriginales para el nuevo detalle
  this.clientesOriginales[nuevoIndex] = { cliente_nombre: undefined, detalle_cliente: undefined };
  this.expandidos[nuevoIndex] = true;
  this.emitirCambios();
}
  
// multi-servicio-selector.component.ts - MODIFICAR removerDetalle
removerDetalle(index: number, event: Event) {
  event?.stopPropagation();
  if (this.detalles.length > 1) {
    this.detalles.splice(index, 1);
    // ✅ Eliminar la entrada de clientesOriginales
    delete this.clientesOriginales[index];
    // Reindexar clientesOriginales (opcional, pero recomendado)
    const newClientesOriginales: typeof this.clientesOriginales = {};
    Object.keys(this.clientesOriginales).forEach(key => {
      const oldIndex = parseInt(key);
      if (oldIndex > index) {
        newClientesOriginales[oldIndex - 1] = this.clientesOriginales[oldIndex];
      } else if (oldIndex < index) {
        newClientesOriginales[oldIndex] = this.clientesOriginales[oldIndex];
      }
    });
    this.clientesOriginales = newClientesOriginales;
    
    delete this.expandidos[index];
    this.calcularTotal();
    this.emitirCambios();
  }
}
  
// multi-servicio-selector.component.ts - CORREGIR calcularTotal
calcularTotal() {
  // ✅ Asegurar que precio_unitario sea número
  this.totalGeneral = this.detalles.reduce((sum, d) => {
    const precio = typeof d.precio_unitario === 'string' 
      ? parseFloat(d.precio_unitario) 
      : (d.precio_unitario || 0);
    return sum + precio;
  }, 0);
  
  console.log('💰 Total calculado:', this.totalGeneral);
  this.totalChange.emit(this.totalGeneral);
}
  
  emitirCambios() {
    this.detallesChange.emit(this.detalles);
    if (this.tipoCliente === 'unico') {
      this.clienteGlobalChange.emit(this.clienteUnico);
    }
  }
  
  abrirSelectorImagen(index: number) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) this.procesarImagen(index, file);
    };
    input.click();
  }
  
  private procesarImagen(index: number, file: File) {
    if (file.size > 15 * 1024 * 1024) {
      Swal.fire('Error', 'La imagen no puede superar los 15MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.detalles[index].imagen_preview = e.target?.result as string;
      this.detalles[index].imagen_nombre = file.name;
      this.detalles[index].imagen_file = file;
      this.emitirCambios();
    };
    reader.readAsDataURL(file);
  }
  
  removerImagen(index: number) {
    this.detalles[index].imagen_preview = undefined;
    this.detalles[index].imagen_nombre = undefined;
    this.detalles[index].imagen_file = undefined;
    this.emitirCambios();
  }
  

// multi-servicio-selector.component.ts - AGREGAR ESTE MÉTODO

// ✅ Misma lógica que en orden-detalle.component.ts
async verImagenServicio(url: string) {
  // Asegurar que la URL sea completa
  let imagenUrl = url;
  if (url && !url.startsWith('http') && !url.startsWith('data:')) {
    const baseUrl = environment.apiUrl.replace('/api', '');
    imagenUrl = `${baseUrl}${url}`;
  }
  
  console.log('🔍 Mostrando imagen:', imagenUrl);
  
  // Crear un elemento de imagen temporal para obtener dimensiones
  const img = new Image();
  img.src = imagenUrl;
  
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });
  
  // Calcular dimensiones máximas (80% de la pantalla)
  const maxWidth = window.innerWidth * 0.8;
  const maxHeight = window.innerHeight * 0.8;
  
  let imageWidth = img.width;
  let imageHeight = img.height;
  
  // Si la imagen es más grande que la pantalla, escalarla
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

// multi-servicio-selector.component.ts - AGREGAR ESTE MÉTODO

/**
 * Obtiene los servicios filtrados para un índice específico
 * Devuelve un array vacío si no hay datos para evitar errores
 */
getServiciosFiltrados(index: number): any[] {
  return this.serviciosFiltradosPorIndice[index] || [];
}



}