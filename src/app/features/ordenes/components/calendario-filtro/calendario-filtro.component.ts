// calendario-filtro.component.ts
import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
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
export class CalendarioFiltroComponent implements OnInit, OnDestroy {
  @Output() filtrosAplicados = new EventEmitter<any>();
  @Input() doctores: any[] = [];
  
  doctorSeleccionado: any = null;
  tipoFecha: 'registro' | 'limite' = 'limite';
  estadoSeleccionado: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';
  cargando: boolean = false;
  
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
    nowIndicator: true
  };
  
  constructor(
    private ordenService: OrdenService,
    private doctorService: DoctorService
  ) {}
  
  ngOnInit() {
    this.cargarDoctores();
  }
  
  cargarDoctores() {
    if (this.doctores.length === 0) {
      this.subscriptions.push(
        this.doctorService.getDoctores().subscribe({
          next: (data) => {
            this.doctores = data;
          }
        })
      );
    }
  }
  
  async cargarEventos(info: any, successCallback: any, failureCallback: any) {
    this.cargando = true;
    
    const fechaInicio = info.startStr.split('T')[0];
    const fechaFin = info.endStr.split('T')[0];
    
    // Guardar para filtros
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
          const eventos = ordenes.map(orden => {
            // Determinar color según estado y vencimiento
            let color = '#6366f1'; // morado por defecto
            let textColor = 'white';
            
            if (orden.estado === 'terminado') {
              color = '#10b981'; // verde
            } else if (orden.saldo <= 0) {
              color = '#10b981'; // verde (pagado)
            } else if (this.tipoFecha === 'limite' && orden.fecha_limite) {
              const hoy = new Date();
              const fechaLimite = new Date(orden.fecha_limite);
              if (fechaLimite < hoy) {
                color = '#f43f5e'; // rojo vencido
              } else if (fechaLimite < new Date(hoy.setDate(hoy.getDate() + 2))) {
                color = '#f59e0b'; // naranja próximo a vencer
              }
            }
            
            // Título del evento
            let title = `${orden.doctor?.nombre?.substring(0, 15) || 'Sin doctor'} - ${orden.servicio?.nombre?.substring(0, 20) || 'Sin servicio'}`;
            if (orden.cliente_nombre) {
              title += ` (${orden.cliente_nombre.substring(0, 15)})`;
            }
            
            return {
              id: orden.id.toString(),
              title: title,
              start: this.tipoFecha === 'limite' ? orden.fecha_limite : orden.fecha_registro,
              end: this.tipoFecha === 'limite' ? orden.fecha_limite : orden.fecha_registro,
              color: color,
              textColor: textColor,
              extendedProps: {
                orden: orden,
                doctor: orden.doctor,
                servicio: orden.servicio,
                saldo: orden.saldo,
                total: orden.total
              },
              allDay: true
            };
          });
          
          successCallback(eventos);
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error cargando eventos:', error);
          failureCallback(error);
          this.cargando = false;
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
    // Al hacer clic en un evento, ir al detalle de la orden
    const ordenId = event.event.id;
    window.location.href = `/ordenes/${ordenId}`;
  }
  
  onEventMount(info: any) {
    // Agregar tooltip con información detallada
    const orden = info.event.extendedProps.orden;
    const tooltip = document.createElement('div');
    tooltip.className = 'calendar-tooltip';
    tooltip.innerHTML = `
      <strong>${orden.doctor?.nombre || 'Sin doctor'}</strong><br>
      <span>📋 ${orden.servicio?.nombre || 'Sin servicio'}</span><br>
      <span>💰 Total: S/ ${orden.total}</span><br>
      <span>💵 Saldo: S/ ${orden.saldo}</span>
      ${orden.cliente_nombre ? `<span>👤 ${orden.cliente_nombre}</span>` : ''}
    `;
    
    info.el.setAttribute('title', `${orden.doctor?.nombre} - ${orden.servicio?.nombre}`);
    info.el.style.cursor = 'pointer';
    
    // Efecto hover
    info.el.addEventListener('mouseenter', () => {
      info.el.style.transform = 'scale(1.02)';
      info.el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    info.el.addEventListener('mouseleave', () => {
      info.el.style.transform = 'scale(1)';
      info.el.style.boxShadow = 'none';
    });
  }
  
  aplicarFiltros() {
    // Refrescar el calendario con los filtros actuales
    const calendarApi = (document.querySelector('full-calendar') as any)?.getApi();
    if (calendarApi) {
      calendarApi.refetchEvents();
    }
    
    // Emitir filtros para la tabla
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
    this.aplicarFiltros();
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}