import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReporteService } from '../../../../core/services/reporte.service';
import { Subscription } from 'rxjs';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-morosidad-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MonedaPipe, FechaPipe, LoadingSpinnerComponent],
  templateUrl: './morosidad-reporte.component.html',
  styleUrls: ['./morosidad-reporte.component.css']
})
export class MorosidadReporteComponent implements OnInit, OnDestroy {
  deuda: any[] = [];
  deudaFiltrada: any[] = [];
  deudaPaginada: any[] = [];
  resumen = {
    deudaTotal: 0,
    clientesMorosos: 0,
    ordenesVencidas: 0
  };
  cargando = true;
  
  // Paginación
  paginaActual: number = 1;
  itemsPerPage: number = 10;
  
  // Filtros
  filtroDoctor: string = '';
  filtroDiasMora: string = 'todos'; // todos, critico (>30), moderado (15-30), leve (<15)
   // ✅ Propiedades para los totales del footer
  totalDeudaFiltrada: number = 0;
  totalVencidasFiltradas: number = 0;
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
      this.reporteService.getReporteMorosidad().subscribe({
        next: (data) => {
          this.deuda = data.detalle;
          this.resumen = data.resumen;
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

  aplicarFiltros() {
    let filtrados = [...this.deuda];
    
    // Filtro por nombre del doctor
    if (this.filtroDoctor.trim()) {
      const termino = this.filtroDoctor.toLowerCase();
      filtrados = filtrados.filter(d => d.doctor.toLowerCase().includes(termino));
    }
    
    // Filtro por días de mora
    if (this.filtroDiasMora === 'critico') {
      filtrados = filtrados.filter(d => d.diasMora > 30);
    } else if (this.filtroDiasMora === 'moderado') {
      filtrados = filtrados.filter(d => d.diasMora >= 15 && d.diasMora <= 30);
    } else if (this.filtroDiasMora === 'leve') {
      filtrados = filtrados.filter(d => d.diasMora > 0 && d.diasMora < 15);
    }
    
    this.deudaFiltrada = filtrados;
      // ✅ Calcular totales
    this.calcularTotales();
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

// ✅ Método para calcular totales
  calcularTotales() {
    this.totalDeudaFiltrada = this.deudaFiltrada.reduce((sum, d) => sum + (d.deuda || 0), 0);
    this.totalVencidasFiltradas = this.deudaFiltrada.reduce((sum, d) => sum + (d.vencidas || 0), 0);
  }


  limpiarFiltros() {
    this.filtroDoctor = '';
    this.filtroDiasMora = 'todos';
    this.aplicarFiltros();
  }

  actualizarPaginacion() {
    const pagina = Number(this.paginaActual);
    const items = Number(this.itemsPerPage);
    
    const inicio = (pagina - 1) * items;
    const fin = inicio + items;
    const finReal = Math.min(fin, this.deudaFiltrada.length);
    
    this.deudaPaginada = [...this.deudaFiltrada.slice(inicio, finReal)];
    this.cdr.detectChanges();
  }

  cambiarPagina(pagina: number) {
    const totalPaginas = Math.ceil(this.deudaFiltrada.length / Number(this.itemsPerPage));
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
    return Math.ceil(this.deudaFiltrada.length / Number(this.itemsPerPage));
  }

  get inicioMostrando(): number {
    if (this.deudaFiltrada.length === 0) return 0;
    return (this.paginaActual - 1) * Number(this.itemsPerPage) + 1;
  }

  get finMostrando(): number {
    return Math.min(this.paginaActual * Number(this.itemsPerPage), this.deudaFiltrada.length);
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
      this.reporteService.exportarExcel('morosidad').subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `reporte_morosidad_${new Date().toISOString().split('T')[0]}.xlsx`;
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

  getDiasMoraClass(dias: number): string {
    if (dias > 30) return 'critico';
    if (dias >= 15) return 'moderado';
    if (dias > 0) return 'leve';
    return '';
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    console.log('🧹 MorosidadReporteComponent destruido');
  }
}