import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ReporteService } from '../../../../core/services/reporte.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { Chart, registerables } from 'chart.js';
import Swal from 'sweetalert2';
import { SumPipe } from '../../../../shared/pipes/sum.pipe';

Chart.register(...registerables);

@Component({
  selector: 'app-productividad-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MonedaPipe, FechaPipe, LoadingSpinnerComponent, SumPipe],
  templateUrl: './productividad-reporte.component.html',
  styleUrls: ['./productividad-reporte.component.css']
})
export class ProductividadReporteComponent implements OnInit, OnDestroy {
  rendimiento: any[] = [];
  rendimientoFiltrado: any[] = [];
  rendimientoPaginado: any[] = []; // ✅ Nuevo: para paginación
  tendenciaMensual: any[] = [];
  tendenciaFiltrada: any[] = [];
  resumen = {
    eficiencia: 0,
    completadasMes: 0,
    totalCompletadas: 0,
    totalPendientes: 0
  };
  cargando = true;
  chartEstados: Chart | null = null;
  chartTendencia: Chart | null = null;
  
  // Filtros
  filtros = {
    fechaInicio: '',
    fechaFin: '',
    doctor: ''
  };
  
  doctores: string[] = [];
  mostrarFiltros = false;
  
  // ✅ Paginación
  paginaActual: number = 1;
  itemsPerPage: number = 10;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private reporteService: ReporteService,
    private router: Router,
    private cdr: ChangeDetectorRef  // ✅ Añadir ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargando = true;
    
    this.subscriptions.push(
      this.reporteService.getReporteProductividad().subscribe({
        next: (data) => {
          console.log('📊 Datos de productividad:', data);
          this.rendimiento = data.rendimiento;
          this.resumen = data.resumen;
          this.doctores = [...new Set(this.rendimiento.map(r => r.doctor))].sort();
          this.rendimientoFiltrado = [...this.rendimiento];
          
          // ✅ Resetear paginación
          this.paginaActual = 1;
          this.actualizarPaginacion();
          
          this.cargarTendenciaMensual();
        },
        error: (error) => {
          console.error('Error cargando reporte:', error);
          this.cargando = false;
          Swal.fire('Error', 'No se pudo cargar el reporte', 'error');
        }
      })
    );
  }

  // ✅ Método para actualizar la paginación
  actualizarPaginacion() {
    const pagina = Number(this.paginaActual);
    const items = Number(this.itemsPerPage);
    
    const inicio = (pagina - 1) * items;
    const fin = inicio + items;
    const finReal = Math.min(fin, this.rendimientoFiltrado.length);
    
    this.rendimientoPaginado = [...this.rendimientoFiltrado.slice(inicio, finReal)];
    
    this.cdr.detectChanges();
  }

  // ✅ Método para cambiar de página
  cambiarPagina(pagina: number) {
    const totalPaginas = Math.ceil(this.rendimientoFiltrado.length / Number(this.itemsPerPage));
    if (pagina !== this.paginaActual && pagina >= 1 && pagina <= totalPaginas) {
      this.paginaActual = pagina;
      this.actualizarPaginacion();
    }
  }

  // ✅ Método para cambiar items por página
  cambiarItemsPorPagina() {
    this.itemsPerPage = Number(this.itemsPerPage);
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  // ✅ Getters para la paginación
  get totalPaginas(): number {
    return Math.ceil(this.rendimientoFiltrado.length / Number(this.itemsPerPage));
  }

  get inicioMostrando(): number {
    if (this.rendimientoFiltrado.length === 0) return 0;
    return (this.paginaActual - 1) * Number(this.itemsPerPage) + 1;
  }

  get finMostrando(): number {
    return Math.min(this.paginaActual * Number(this.itemsPerPage), this.rendimientoFiltrado.length);
  }

  // ✅ Getter para los números de página
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

  cargarTendenciaMensual() {
    this.subscriptions.push(
      this.reporteService.getTendenciaMensual().subscribe({
        next: (data) => {
          console.log('📊 Tendencia mensual:', data);
          this.tendenciaMensual = data;
          this.tendenciaFiltrada = [...this.tendenciaMensual];
          setTimeout(() => {
            this.crearGraficos();
          }, 0);
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error cargando tendencia:', error);
          this.cargando = false;
          this.crearGraficos();
        }
      })
    );
  }

  aplicarFiltros() {
    // Filtrar rendimiento por doctor
    if (this.filtros.doctor) {
      this.rendimientoFiltrado = this.rendimiento.filter(
        r => r.doctor === this.filtros.doctor
      );
    } else {
      this.rendimientoFiltrado = [...this.rendimiento];
    }
    
    // ✅ Resetear paginación al aplicar filtros
    this.paginaActual = 1;
    this.actualizarPaginacion();
    
    // Filtrar tendencia por rango de fechas
    if (this.filtros.fechaInicio || this.filtros.fechaFin) {
      const fechaInicio = this.filtros.fechaInicio ? new Date(this.filtros.fechaInicio) : null;
      const fechaFin = this.filtros.fechaFin ? new Date(this.filtros.fechaFin) : null;
      
      this.tendenciaFiltrada = this.tendenciaMensual.filter(t => {
        const mesesMap: { [key: string]: number } = {
          'Ene': 0, 'Feb': 1, 'Mar': 2, 'Abr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Ago': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dic': 11
        };
        
        const añoActual = new Date().getFullYear();
        const fechaMes = new Date(añoActual, mesesMap[t.mes], 1);
        
        if (fechaInicio && fechaMes < fechaInicio) return false;
        if (fechaFin && fechaMes > fechaFin) return false;
        return true;
      });
    } else {
      this.tendenciaFiltrada = [...this.tendenciaMensual];
    }
    
    this.actualizarGraficos();
  }

  limpiarFiltros() {
    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      doctor: ''
    };
    this.rendimientoFiltrado = [...this.rendimiento];
    this.tendenciaFiltrada = [...this.tendenciaMensual];
    
    // ✅ Resetear paginación
    this.paginaActual = 1;
    this.actualizarPaginacion();
    this.actualizarGraficos();
  }

  crearGraficos() {
    this.crearGraficoEstados();
    this.crearGraficoTendencia();
  }

  actualizarGraficos() {
    if (this.chartEstados) {
      const pendientes = this.rendimientoFiltrado.reduce((sum, r) => sum + (r.pendientes || 0), 0);
      const completadas = this.rendimientoFiltrado.reduce((sum, r) => sum + (r.completadas || 0), 0);
      this.chartEstados.data.datasets[0].data = [pendientes, completadas];
      this.chartEstados.update();
    }
    
    if (this.chartTendencia && this.tendenciaFiltrada.length > 0) {
      const meses = this.tendenciaFiltrada.map(t => t.mes);
      const completadas = this.tendenciaFiltrada.map(t => t.completadas);
      this.chartTendencia.data.labels = meses;
      this.chartTendencia.data.datasets[0].data = completadas;
      this.chartTendencia.update();
    }
  }

  crearGraficoEstados() {
    const canvas = document.getElementById('estadosChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    if (this.chartEstados) this.chartEstados.destroy();
    
    const pendientes = this.rendimientoFiltrado.reduce((sum, r) => sum + (r.pendientes || 0), 0);
    const completadas = this.rendimientoFiltrado.reduce((sum, r) => sum + (r.completadas || 0), 0);
    
    this.chartEstados = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Pendientes', 'Terminadas'],
        datasets: [{
          data: [pendientes, completadas],
          backgroundColor: ['#f59e0b', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = pendientes + completadas;
                const value = context.raw as number;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${context.label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  crearGraficoTendencia() {
    const canvas = document.getElementById('tendenciaChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    if (this.chartTendencia) this.chartTendencia.destroy();
    
    const meses = this.tendenciaFiltrada.map(t => t.mes);
    const completadas = this.tendenciaFiltrada.map(t => t.completadas);
    
    this.chartTendencia = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [{
          label: 'Órdenes Completadas',
          data: completadas,
          backgroundColor: '#8b5cf6',
          borderRadius: 8,
          barPercentage: 0.7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Completadas: ${context.raw}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              callback: (value) => value.toString()
            },
            title: {
              display: true,
              text: 'Cantidad de órdenes'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Mes'
            }
          }
        }
      }
    });
  }

  exportarExcel() {
    this.subscriptions.push(
      this.reporteService.exportarExcel('productividad').subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `reporte_productividad_${new Date().toISOString().split('T')[0]}.xlsx`;
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

  getMesActual(): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const hoy = new Date();
    return meses[hoy.getMonth()];
  }

  calcularEficienciaTotal(): number {
    const totalCompletadas = this.rendimientoFiltrado.reduce((sum, r) => sum + (r.completadas || 0), 0);
    const totalPendientes = this.rendimientoFiltrado.reduce((sum, r) => sum + (r.pendientes || 0), 0);
    const total = totalCompletadas + totalPendientes;
    return total > 0 ? Math.round((totalCompletadas * 100) / total) : 0;
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    
    if (this.chartEstados) this.chartEstados.destroy();
    if (this.chartTendencia) this.chartTendencia.destroy();
    
    console.log('🧹 ProductividadReporteComponent destruido');
  }
}