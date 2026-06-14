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
import { Router } from '@angular/router';  // ✅ Agregar import
import { ViewChild } from '@angular/core';  // ✅ Agregar import
import { FullCalendarComponent } from '@fullcalendar/angular';  // ✅ Agregar import
@Component({
  selector: 'app-calendario-filtro',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, SearchableSelectComponent],
  templateUrl: './calendario-filtro.component.html',
  styleUrls: ['./calendario-filtro.component.css']
})
export class CalendarioFiltroComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('fullCalendar') fullCalendar!: FullCalendarComponent;  // ← AGREGAR
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
  // calendario-filtro.component.ts - Modificar calendarOptions
calendarOptions: any = {
    plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin],
    initialView: 'dayGridMonth',
    locale: 'es',  // ✅ Ya está, pero asegurar que funciona
    firstDay: 1,   // ✅ Semana empieza en lunes
    slotLabelFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false  // ✅ Formato 24 horas
    },
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
     slotMinTime: '08:00:00',  // Empieza a las 8 AM
    slotMaxTime: '21:00:00',  // Termina a las 9 PM
    slotDuration: '00:30:00', // Intervalos de 30 minutos
    allDaySlot: true,         // Mostrar slot de "todo el día"
    nowIndicator: true,       // Mostrar línea de hora actual
    loading: this.onLoading.bind(this)
  };
  
  constructor(
    private ordenService: OrdenService,
    private doctorService: DoctorService,
    private cdr: ChangeDetectorRef,
    private router: Router  // ← AGREGAR ESTO
  ) {}
  
  ngOnInit() {
    if (this.doctores.length === 0) {
      this.cargarDoctores();
    }
  }
  
 ngAfterViewInit() {
        this.cdr.detectChanges();
        // ✅ Guardar referencia al API del calendario
        if (this.fullCalendar) {
            this.calendarApi = this.fullCalendar.getApi();
        }
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
          if (orden.detalles && orden.detalles.length > 0) {
            orden.detalles.forEach((detalle: any) => {
              let fechaEvento = null;
              let horaEvento = null;
              
              if (this.tipoFecha === 'limite') {
                fechaEvento = detalle.fecha_limite;
                horaEvento = detalle.hora_limite;
              } else {
                fechaEvento = orden.fecha_registro?.split('T')[0];
                horaEvento = orden.fecha_registro?.split('T')[1]?.substring(0, 5);
              }
              
              if (!fechaEvento) return;
              
              // ✅ Construir fecha y hora para el evento
              let startDateTime = fechaEvento;
              if (horaEvento) {
                startDateTime = `${fechaEvento}T${horaEvento}`;
              } else {
                startDateTime = `${fechaEvento}T00:00:00`;
              }
              
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
                start: startDateTime,  // ✅ Incluye hora si existe
                end: startDateTime,
                color: color,
                textColor: 'white',
                extendedProps: {
                  orden: orden,
                  detalle: detalle,
                  doctor: orden.doctor,
                  servicio: detalle.servicio
                },
                allDay: !horaEvento  // ✅ Solo allDay si NO tiene hora
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
  
// Reemplazar el método onEventClick
onEventClick(event: any) {
    // El ID del evento tiene formato "ordenId-detalleId"
    const eventId = event.event.id;
    if (eventId) {
        // Extraer solo el ordenId (la parte antes del guión)
        const ordenId = eventId.split('-')[0];
        if (ordenId && !isNaN(parseInt(ordenId))) {
            // ✅ Usar Router.navigate para navegación interna (SIN recargar)
            this.router.navigate(['/ordenes', ordenId]);
        }
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
  
// calendario-filtro.component.ts - MODIFICAR aplicarFiltros

aplicarFiltros() {
  // Guardar posición del scroll antes de refrescar
  const scrollY = window.scrollY;
  
  // Refrescar el calendario
  if (this.calendarApi) {
    this.calendarApi.refetchEvents();
  }
  
  this.filtrosAplicados.emit({
    doctor_id: this.doctorSeleccionado?.id,
    tipo_fecha: this.tipoFecha,
    estado: this.estadoSeleccionado
  });
  
  // Restaurar posición del scroll después de un pequeño delay
  setTimeout(() => {
    window.scrollTo(0, scrollY);
  }, 50);
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