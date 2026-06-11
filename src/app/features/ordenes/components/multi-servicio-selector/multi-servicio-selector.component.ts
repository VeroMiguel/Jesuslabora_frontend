// multi-servicio-selector.component.ts
import { Component, Input, Output, EventEmitter, OnInit, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServicioService } from '../../../../core/services/servicio.service';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './multi-servicio-selector.component.html',
  styleUrls: ['./multi-servicio-selector.component.css']
})
export class MultiServicioSelectorComponent implements OnInit {
  @Input() serviciosDisponibles: any[] = [];
  @Input() detallesIniciales: DetalleServicio[] = [];
  @Output() detallesChange = new EventEmitter<DetalleServicio[]>();
  @Output() totalChange = new EventEmitter<number>();
  
  detalles: DetalleServicio[] = [];
  totalGeneral: number = 0;
  servicioBuscado: string = '';
  mostrandoLista: boolean = false;
  serviciosFiltrados: any[] = [];
  
  constructor(private servicioService: ServicioService) {}
  
  ngOnInit() {
    this.cargarServicios();
    
    if (this.detallesIniciales && this.detallesIniciales.length > 0) {
      this.detalles = this.detallesIniciales;
      this.calcularTotal();
    } else {
      this.agregarDetalle();
    }
  }
  
  cargarServicios() {
    if (this.serviciosDisponibles.length === 0) {
      this.servicioService.getServicios().subscribe({
        next: (data) => {
          this.serviciosDisponibles = data;
        }
      });
    }
  }
  
  filtrarServicios() {
    if (!this.servicioBuscado.trim()) {
      this.serviciosFiltrados = [];
      this.mostrandoLista = false;
      return;
    }
    
    const busqueda = this.servicioBuscado.toLowerCase();
    this.serviciosFiltrados = this.serviciosDisponibles.filter(s => 
      s.nombre.toLowerCase().includes(busqueda)
    ).slice(0, 10);
    
    this.mostrandoLista = this.serviciosFiltrados.length > 0;
  }
  
  seleccionarServicio(detalle: DetalleServicio, servicio: any) {
    detalle.servicio_id = servicio.id;
    detalle.servicio_nombre = servicio.nombre;
    detalle.precio_unitario = servicio.precio_referencial || 0;
    this.calcularSubtotal(detalle);
    this.servicioBuscado = '';
    this.mostrandoLista = false;
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