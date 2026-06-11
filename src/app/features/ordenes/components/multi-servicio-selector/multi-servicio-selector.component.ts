// multi-servicio-selector.component.ts - VERSIÓN CORREGIDA
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServicioService } from '../../../../core/services/servicio.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';

export interface DetalleServicio {
  id?: number;
  servicio_id: number | null;
  servicio_nombre?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  fecha_limite: string;
  hora_limite: string;
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
  @Output() detallesChange = new EventEmitter<DetalleServicio[]>();
  @Output() totalChange = new EventEmitter<number>();
  
  detalles: DetalleServicio[] = [];
  totalGeneral: number = 0;
  
  // Para el dropdown de cada servicio
  indicesActivos: { [key: number]: boolean } = {};
  busquedaPorIndice: { [key: number]: string } = {};
  serviciosFiltradosPorIndice: { [key: number]: any[] } = {};
  
  constructor(private servicioService: ServicioService) {}
  
  ngOnInit() {
    if (this.serviciosDisponibles.length === 0) {
      this.servicioService.getServicios().subscribe({
        next: (data) => {
          this.serviciosDisponibles = data;
        }
      });
    }
    
    if (this.detallesIniciales && this.detallesIniciales.length > 0) {
      this.detalles = this.detallesIniciales;
      this.calcularTotal();
    } else {
      this.agregarDetalle();
    }
  }


  ngOnChanges(changes: SimpleChanges) {
    // ✅ Detectar cambios en detallesIniciales
    if (changes['detallesIniciales'] && changes['detallesIniciales'].currentValue) {
      const nuevosDetalles = changes['detallesIniciales'].currentValue;
      if (nuevosDetalles && nuevosDetalles.length > 0) {
        this.detalles = [...nuevosDetalles];
        this.calcularTotal();
        this.emitirCambios();
      }
    }
  }
  
  toggleDropdown(index: number) {
    // Cerrar otros dropdowns
    Object.keys(this.indicesActivos).forEach(key => {
      if (parseInt(key) !== index) {
        this.indicesActivos[parseInt(key)] = false;
      }
    });
    this.indicesActivos[index] = !this.indicesActivos[index];
    
    if (this.indicesActivos[index]) {
      this.filtrarServicios(index, this.busquedaPorIndice[index] || '');
    }
  }
  
  filtrarServicios(index: number, busqueda: string) {
    this.busquedaPorIndice[index] = busqueda;
    
    if (!busqueda || busqueda.trim() === '') {
      this.serviciosFiltradosPorIndice[index] = [];
      return;
    }
    
    const busquedaLower = busqueda.toLowerCase();
    this.serviciosFiltradosPorIndice[index] = this.serviciosDisponibles.filter(s => 
      s.nombre.toLowerCase().includes(busquedaLower)
    ).slice(0, 10);
  }
  
  seleccionarServicio(index: number, servicio: any) {
    this.detalles[index].servicio_id = servicio.id;
    this.detalles[index].servicio_nombre = servicio.nombre;
    this.detalles[index].precio_unitario = servicio.precio_referencial || 0;
    this.calcularSubtotal(this.detalles[index]);
    this.indicesActivos[index] = false;
    this.busquedaPorIndice[index] = '';
    this.emitirCambios();
  }
  
  agregarDetalle() {
    this.detalles.push({
      servicio_id: null,
      cantidad: 1,
      precio_unitario: 0,
      subtotal: 0,
      fecha_limite: '',
      hora_limite: ''
    });
    this.emitirCambios();
  }
  
  removerDetalle(index: number) {
    if (this.detalles.length > 1) {
      this.detalles.splice(index, 1);
      // Limpiar índices
      delete this.indicesActivos[index];
      delete this.busquedaPorIndice[index];
      delete this.serviciosFiltradosPorIndice[index];
      this.calcularTotal();
      this.emitirCambios();
    }
  }
  
  calcularSubtotal(detalle: DetalleServicio) {
    detalle.subtotal = (detalle.cantidad || 0) * (detalle.precio_unitario || 0);
    this.calcularTotal();
    this.emitirCambios();
  }
  
  calcularTotal() {
    this.totalGeneral = this.detalles.reduce((sum, d) => sum + (d.subtotal || 0), 0);
    this.totalChange.emit(this.totalGeneral);
  }
  
  emitirCambios() {
    this.detallesChange.emit(this.detalles);
  }

}