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
  doctoresFiltrados: any[] = [];  // Datos después de filtros
  doctoresPaginados: any[] = [];  // Datos paginados
  cargando = true;
  
  totalDoctores = 0;
  deudaTotal = 0;
  totalPendientes = 0;
  totalFacturado = 0;
  totalPagado = 0;
  
  topDoctores: any[] = [];
  topDeudores: any[] = [];
  
  // Paginación
  paginaActual: number = 1;
  itemsPerPage: number = 10;
  
  // Filtros
  filtroNombre: string = '';
  filtroDeuda: string = 'todos'; // todos, conDeuda, sinDeuda
  
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
    this.subscriptions.push(
      this.reporteService.getReporteDoctores().subscribe({
        next: (data) => {
          this.doctores = data.doctores;
          this.doctoresFiltrados = [...this.doctores];
          
          this.totalDoctores = data.doctores.length;
          this.deudaTotal = data.doctores.reduce((sum: number, d: any) => sum + (d.deuda_total || 0), 0);
          this.totalPendientes = data.doctores.reduce((sum: number, d: any) => sum + (d.ordenes_pendientes || 0), 0);
          this.totalFacturado = data.doctores.reduce((sum: number, d: any) => sum + (d.total_facturado || 0), 0);
          this.totalPagado = data.doctores.reduce((sum: number, d: any) => sum + (d.total_pagado || 0), 0);
          
          this.topDoctores = [...data.doctores]
            .sort((a, b) => b.total_ordenes - a.total_ordenes)
            .slice(0, 5);
          
          this.topDeudores = [...data.doctores]
            .sort((a, b) => b.deuda_total - a.deuda_total)
            .slice(0, 5);
          
          this.aplicarFiltros();
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

 // doctores-reporte.component.ts - Modifica aplicarFiltros()

aplicarFiltros() {
  let filtrados = [...this.doctores];
  
  // ✅ Filtro por nombre - Usa 'doctor' en lugar de 'nombre'
  if (this.filtroNombre.trim()) {
    const termino = this.filtroNombre.toLowerCase();
    filtrados = filtrados.filter(d => d.doctor.toLowerCase().includes(termino)); // ← Cambiado: d.doctor
  }
  
  // Filtro por deuda (esto está bien porque deuda_total sí existe)
  if (this.filtroDeuda === 'conDeuda') {
    filtrados = filtrados.filter(d => d.deuda_total > 0);
  } else if (this.filtroDeuda === 'sinDeuda') {
    filtrados = filtrados.filter(d => d.deuda_total === 0);
  }
  
  this.doctoresFiltrados = filtrados;
  this.paginaActual = 1;
  this.actualizarPaginacion();
}

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroDeuda = 'todos';
    this.aplicarFiltros();
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
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    console.log('🧹 DoctoresReporteComponent destruido');
  }
}