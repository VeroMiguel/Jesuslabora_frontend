import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ReporteService } from '../../../../core/services/reporte.service';
import { MonedaPipe } from '../../../../shared/pipes/moneda.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { Chart, registerables } from 'chart.js';
import Swal from 'sweetalert2';

Chart.register(...registerables);

@Component({
  selector: 'app-servicios-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MonedaPipe, LoadingSpinnerComponent],
  templateUrl: './servicios-reporte.component.html',
  styleUrls: ['./servicios-reporte.component.css']
})
export class ServiciosReporteComponent implements OnInit, OnDestroy {
  servicios: any[] = [];
  serviciosPaginados: any[] = [];
  cargando = true;
  chart1: Chart | null = null;
  chart2: Chart | null = null;
  
  // Paginación
  paginaActual: number = 1;
  itemsPerPage: number = 10;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private reporteService: ReporteService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarDatos();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    
    if (this.chart1) this.chart1.destroy();
    if (this.chart2) this.chart2.destroy();
    
    console.log('🧹 ServiciosReporteComponent destruido');
  }

  cargarDatos() {
    this.cargando = true;
    this.subscriptions.push(
      this.reporteService.getReporteServicios().subscribe({
        next: (data) => {
          // Ordenar por cantidad DESC (los más populares primero)
          this.servicios = data.sort((a: any, b: any) => b.cantidad - a.cantidad);
          console.log('📊 Servicios cargados:', this.servicios.length);
          
          this.paginaActual = 1;
          this.actualizarPaginacion();
          this.crearGraficos();
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

  actualizarPaginacion() {
    // Asegurar que sean números
    const pagina = Number(this.paginaActual);
    const items = Number(this.itemsPerPage);
    
    const inicio = (pagina - 1) * items;
    const fin = inicio + items;
    const finReal = Math.min(fin, this.servicios.length);
    
    console.log('🔍 actualizarPaginacion - llamado con:', {
      paginaActual: pagina,
      itemsPerPage: items,
      inicio,
      fin,
      finReal,
      totalServicios: this.servicios.length,
      tipoItemsPerPage: typeof this.itemsPerPage
    });
    
    this.serviciosPaginados = [...this.servicios.slice(inicio, finReal)];
    
    console.log('🔍 serviciosPaginados length:', this.serviciosPaginados.length);
    
    this.cdr.detectChanges();
  }

  cambiarPagina(pagina: number) {
    const totalPaginas = Math.ceil(this.servicios.length / Number(this.itemsPerPage));
    if (pagina !== this.paginaActual && pagina >= 1 && pagina <= totalPaginas) {
      console.log(`📄 Cambiando de página ${this.paginaActual} a ${pagina}`);
      this.paginaActual = pagina;
      this.actualizarPaginacion();
    }
  }

  cambiarItemsPorPagina() {
    // Convertir a número - Este es el problema principal
    this.itemsPerPage = Number(this.itemsPerPage);
    
    console.log(`📄 Cambiando items por página a: ${this.itemsPerPage} (tipo: ${typeof this.itemsPerPage})`);
    
    // Resetear a página 1 cuando cambia la cantidad por página
    this.paginaActual = 1;
    
    // Forzar actualización
    this.actualizarPaginacion();
    this.cdr.detectChanges();
  }

  get totalPaginas(): number {
    return Math.ceil(this.servicios.length / Number(this.itemsPerPage));
  }

  get inicioMostrando(): number {
    if (this.servicios.length === 0) return 0;
    return (this.paginaActual - 1) * Number(this.itemsPerPage) + 1;
  }

  get finMostrando(): number {
    return Math.min(this.paginaActual * Number(this.itemsPerPage), this.servicios.length);
  }

  get paginationPages(): (number | string)[] {
    const total = this.totalPaginas;
    const current = this.paginaActual;
    const pages: (number | string)[] = [];
    
    if (total <= 7) {
      // Si hay 7 páginas o menos, mostrar todas
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Siempre mostrar primera página
      pages.push(1);
      
      if (current > 3) {
        pages.push('...');
      }
      
      // Mostrar páginas alrededor de la actual
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (current < total - 2) {
        pages.push('...');
      }
      
      // Siempre mostrar última página
      pages.push(total);
    }
    
    return pages;
  }

  crearGraficos() {
    const ctx1 = document.getElementById('serviciosChart') as HTMLCanvasElement;
    const ctx2 = document.getElementById('ingresosChart') as HTMLCanvasElement;

    if (this.chart1) this.chart1.destroy();
    if (this.chart2) this.chart2.destroy();

    // Mostrar solo los top 10 para los gráficos
    const topServicios = this.servicios.slice(0, 10);
    const nombres = topServicios.map(s => s.nombre);
    const cantidades = topServicios.map(s => s.cantidad);
    const ingresos = topServicios.map(s => s.total_facturado);

    this.chart1 = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: nombres,
        datasets: [{
          label: 'Cantidad de órdenes',
          data: cantidades,
          backgroundColor: '#f59e0b'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.raw} órdenes` } }
        }
      }
    });

    this.chart2 = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: nombres,
        datasets: [{
          data: ingresos,
          backgroundColor: ['#f59e0b', '#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#d946ef', '#14b8a6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  exportarExcel() {
    this.subscriptions.push(
      this.reporteService.exportarExcel('servicios').subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `reporte_servicios_${new Date().toISOString().split('T')[0]}.xlsx`;
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
}