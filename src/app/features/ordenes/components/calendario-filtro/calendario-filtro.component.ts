// calendario-filtro.component.ts - VERSIÓN CORREGIDA
import { Component, OnInit, OnDestroy, Output, EventEmitter, Input, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { OrdenService } from '../../../../core/services/orden.service';
import { DoctorService } from '../../../../core/services/doctor.service';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-calendario-filtro',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, SearchableSelectComponent],
  templateUrl: './calendario-filtro.component.html',
  styleUrls: ['./calendario-filtro.component.css']
})
export class CalendarioFiltroComponent implements OnInit, OnDestroy, AfterViewInit {
  @Output() filtrosAplicados = new EventEmitter<any>();
  @Input() doctores: any[] = [];
  
  doctorSeleccionado: any = null;
  tipoFecha: 'registro' | 'limite' = 'limite';
  estadoSeleccionado: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';
  cargando: boolean = false;
  calendarApi: any = null;
  
  private subscriptions: Subscription[] = [];
  
  calendarOptions: any = {
    plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin],
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek,timeGridDay'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día'
    },
    events: this.cargarEventos.bind(this),
    dateClick: this.onDateClick.bind(this),
    eventClick: this.onEventClick.bind(this),
    eventDidMount: this.onEventMount.bind(this),
    height: 'auto',
    slotMinTime: '08:00:00',
    slotMaxTime: '20:00:00',
    allDaySlot: true,
    nowIndicator: true,
    loading: this.onLoading.bind(this)
  };
  
  constructor(
    private ordenService: OrdenService,
    private doctorService: DoctorService,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit() {
    if (this.doctores.length === 0) {
      this.cargarDoctores();
    }
  }
  
  ngAfterViewInit() {
    this.cdr.detectChanges();
  }
  
  onLoading(isLoading: boolean) {
    this.cargando = isLoading;
    this.cdr.detectChanges();
  }
  
  cargarDoctores() {
    this.subscriptions.push(
      this.doctorService.getDoctores().subscribe({
        next: (data) => {
          this.doctores = data;
        },
        error: (error) => {
          console.error('Error cargando doctores:', error);
        }
      })
    );
  }
  
 // calendario-filtro.component.ts - Modificar cargarEventos
cargarEventos(info: any, successCallback: any, failureCallback: any) {
  const fechaInicio = info.startStr.split('T')[0];
  const fechaFin = info.endStr.split('T')[0];
  
  this.fechaInicio = fechaInicio;
  this.fechaFin = fechaFin;
  
  this.subscriptions.push(
    this.ordenService.getOrdenesConFiltros({
      doctor_id: this.doctorSeleccionado?.id || 'todos',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_fecha: this.tipoFecha,
      estado: this.estadoSeleccionado
    }).subscribe({
      next: (ordenes) => {
        if (!ordenes || !Array.isArray(ordenes)) {
          successCallback([]);
          return;
        }
        
        const eventos: any[] = [];
        
        ordenes.forEach(orden => {
          // ✅ Crear eventos por cada detalle (servicio)
          if (orden.detalles && orden.detalles.length > 0) {
            orden.detalles.forEach((detalle: any) => {
              let fechaEvento = null;
              
              if (this.tipoFecha === 'limite') {
                fechaEvento = detalle.fecha_limite;
              } else {
                fechaEvento = orden.fecha_registro?.split('T')[0];
              }
              
              if (!fechaEvento) return;
              
              let color = '#6366f1';
              
              if (orden.estado === 'terminado') {
                color = '#10b981';
              } else if (this.tipoFecha === 'limite' && detalle.fecha_limite) {
                const hoy = new Date();
                const fechaLimite = new Date(detalle.fecha_limite);
                if (fechaLimite < hoy) {
                  color = '#f43f5e';
                } else if (fechaLimite < new Date(hoy.setDate(hoy.getDate() + 2))) {
                  color = '#f59e0b';
                }
              }
              
              let title = `${orden.doctor?.nombre?.substring(0, 15) || 'Sin doctor'} - ${detalle.servicio?.nombre?.substring(0, 20) || 'Sin servicio'}`;
              
              eventos.push({
                id: `${orden.id}-${detalle.id}`,
                title: title,
                start: fechaEvento,
                end: fechaEvento,
                color: color,
                textColor: 'white',
                extendedProps: {
                  orden: orden,
                  detalle: detalle,
                  doctor: orden.doctor,
                  servicio: detalle.servicio
                },
                allDay: true
              });
            });
          }
        });
        
        successCallback(eventos);
      },
      error: (error) => {
        console.error('Error cargando eventos:', error);
        successCallback([]);
      }
    })
  );
}
  
  onDateClick(event: any) {
    // Al hacer clic en una fecha, filtrar la tabla principal
    this.filtrosAplicados.emit({
      fecha_inicio: event.dateStr,
      fecha_fin: event.dateStr,
      tipo_fecha: this.tipoFecha,
      doctor_id: this.doctorSeleccionado?.id
    });
  }
  
  onEventClick(event: any) {
    const ordenId = event.event.id;
    if (ordenId && !isNaN(parseInt(ordenId))) {
      window.location.href = `/ordenes/${ordenId}`;
    }
  }
  
  onEventMount(info: any) {
    info.el.style.cursor = 'pointer';
    
    info.el.addEventListener('mouseenter', () => {
      info.el.style.transform = 'scale(1.02)';
      info.el.style.transition = 'transform 0.2s';
      info.el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    info.el.addEventListener('mouseleave', () => {
      info.el.style.transform = 'scale(1)';
      info.el.style.boxShadow = 'none';
    });
  }
  
  aplicarFiltros() {
    // Refrescar el calendario
    if (this.calendarApi) {
      this.calendarApi.refetchEvents();
    }
    
    this.filtrosAplicados.emit({
      doctor_id: this.doctorSeleccionado?.id,
      tipo_fecha: this.tipoFecha,
      estado: this.estadoSeleccionado
    });
  }
  
  limpiarFiltros() {
    this.doctorSeleccionado = null;
    this.tipoFecha = 'limite';
    this.estadoSeleccionado = 'todos';
    
    if (this.calendarApi) {
      this.calendarApi.refetchEvents();
    }
    
    this.filtrosAplicados.emit({
      doctor_id: null,
      tipo_fecha: this.tipoFecha,
      estado: 'todos'
    });
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}