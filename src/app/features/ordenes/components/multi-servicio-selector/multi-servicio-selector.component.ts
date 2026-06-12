// multi-servicio-selector.component.ts - VERSIÓN ULTRA COMPACTA
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServicioService } from '../../../../core/services/servicio.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import Swal from 'sweetalert2';

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
}

@Component({
  selector: 'app-multi-servicio-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, MonedaPipe],
  templateUrl: './multi-servicio-selector.component.html',
  styleUrls: ['./multi-servicio-selector.component.css']
})
export class MultiServicioSelectorComponent implements OnInit, OnChanges {
  @Input() serviciosDisponibles: any[] = [];
  @Input() detallesIniciales: DetalleServicio[] = [];
  @Input() clienteGlobal: { nombre: string; detalle: string } = { nombre: '', detalle: '' };
  @Output() detallesChange = new EventEmitter<DetalleServicio[]>();
  @Output() totalChange = new EventEmitter<number>();
  @Output() clienteGlobalChange = new EventEmitter<{ nombre: string; detalle: string }>();
  // multi-servicio-selector.component.ts - AGREGAR ESTOS OUTPUTS
  @Output() tipoClienteChange = new EventEmitter<'unico' | 'multiple'>();






  
  detalles: DetalleServicio[] = [];
  totalGeneral: number = 0;
  expandidos: { [key: number]: boolean } = {};
  tipoCliente: 'unico' | 'multiple' = 'unico';
  clienteUnico = { nombre: '', detalle: '' };
  
  indicesActivos: { [key: number]: boolean } = {};
  busquedaPorIndice: { [key: number]: string } = {};
  serviciosFiltradosPorIndice: { [key: number]: any[] } = {};
  
  constructor(private servicioService: ServicioService) {}
  
  ngOnInit() {
    this.cargarServicios();
    this.inicializarDetalles();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['detallesIniciales']?.currentValue) {
      this.detalles = [...changes['detallesIniciales'].currentValue];
      this.calcularTotal();
    }
    if (changes['clienteGlobal']?.currentValue) {
      this.clienteUnico = { ...changes['clienteGlobal'].currentValue };
    }
  }
  
// Y modificar el método onTipoClienteChange
onTipoClienteChange() {
  this.tipoClienteChange.emit(this.tipoCliente);
  if (this.tipoCliente === 'unico') {
    this.detalles.forEach(d => {
      d.cliente_nombre = undefined;
      d.detalle_cliente = undefined;
    });
  }
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
  
  toggleDropdown(index: number) {
    this.indicesActivos[index] = !this.indicesActivos[index];
    if (this.indicesActivos[index]) {
      this.filtrarServicios(index, this.busquedaPorIndice[index] || '');
    }
  }
  
  filtrarServicios(index: number, busqueda: string) {
    this.busquedaPorIndice[index] = busqueda;
    if (!busqueda?.trim()) {
      this.serviciosFiltradosPorIndice[index] = [];
      return;
    }
    const busquedaLower = busqueda.toLowerCase();
    this.serviciosFiltradosPorIndice[index] = this.serviciosDisponibles
      .filter(s => s.nombre.toLowerCase().includes(busquedaLower))
      .slice(0, 8);
  }
  
// También corregir cuando se selecciona servicio
seleccionarServicio(index: number, servicio: any) {
  this.detalles[index].servicio_id = servicio.id;
  this.detalles[index].servicio_nombre = servicio.nombre;
  // ✅ Asegurar que precio_unitario sea número
  this.detalles[index].precio_unitario = Number(servicio.precio_referencial) || 0;
  this.indicesActivos[index] = false;
  this.busquedaPorIndice[index] = '';
  this.calcularTotal();
  this.emitirCambios();
}
  
  agregarDetalle() {
    this.detalles.push({
      servicio_id: null,
      precio_unitario: 0,
      fecha_limite: '',
      hora_limite: ''
    });
    this.expandidos[this.detalles.length - 1] = true;
    this.emitirCambios();
  }
  
  removerDetalle(index: number, event: Event) {
    event?.stopPropagation();
    if (this.detalles.length > 1) {
      this.detalles.splice(index, 1);
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
  
  verImagen(url: string) {
    Swal.fire({ imageUrl: url, imageAlt: 'Imagen', width: 'auto', showConfirmButton: true });
  }
}