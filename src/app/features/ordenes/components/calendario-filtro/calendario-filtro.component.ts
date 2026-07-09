// calendario-filtro.component.ts - VERSIÓN CORREGIDA

import { Component, OnInit, OnDestroy, Output, EventEmitter, Input, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { OrdenService } from '../../../../core/services/orden.service';
import { DoctorService } from '../../../../core/services/doctor.service';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { Router } from '@angular/router';
import { ViewChild } from '@angular/core';
import { FullCalendarComponent } from '@fullcalendar/angular';

@Component({
  selector: 'app-calendario-filtro',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, SearchableSelectComponent],
  templateUrl: './calendario-filtro.component.html',
  styleUrls: ['./calendario-filtro.component.css']
})
export class CalendarioFiltroComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('fullCalendar') fullCalendar!: FullCalendarComponent;
  @Output() filtrosAplicados = new EventEmitter<any>();
  @Input() doctores: any[] = [];
  
  doctorSeleccionado: any = null;
  tipoFecha: 'registro' | 'limite' = 'limite';
  estadoSeleccionado: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';
  cargando: boolean = false;
  calendarApi: any = null;
  
  // ✅ NUEVOS FILTROS: Mes y Año
  mesSeleccionado: number = 7; // Julio por defecto
  anoSeleccionado: number = 2026;
  
  // ✅ Lista de meses
  meses = [
    { value: 1, nombre: 'Enero' },
    { value: 2, nombre: 'Febrero' },
    { value: 3, nombre: 'Marzo' },
    { value: 4, nombre: 'Abril' },
    { value: 5, nombre: 'Mayo' },
    { value: 6, nombre: 'Junio' },
    { value: 7, nombre: 'Julio' },
    { value: 8, nombre: 'Agosto' },
    { value: 9, nombre: 'Septiembre' },
    { value: 10, nombre: 'Octubre' },
    { value: 11, nombre: 'Noviembre' },
    { value: 12, nombre: 'Diciembre' }
  ];
  
  // ✅ Lista de años (desde 2020 hasta 2040)
  anos: number[] = [];
  
  // Flag para evitar scroll innecesario
  private navegando: boolean = false;
  private actualizandoSelects: boolean = false;
  
  // Almacenar fecha/hora actual del servidor
  private fechaHoraActual: Date = new Date();
  
  private subscriptions: Subscription[] = [];
  
  // CALENDAR OPTIONS
  calendarOptions: any = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: 'es',
    firstDay: 1,
    timeZone: 'America/Lima',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes'
    },
    dayMaxEvents: 3,
    moreLinkText: 'más',
    events: this.cargarEventos.bind(this),
    dateClick: this.onDateClick.bind(this),
    eventClick: this.onEventClick.bind(this),
    eventDidMount: this.onEventMount.bind(this),
    height: 'auto',
    loading: this.onLoading.bind(this),
    datesSet: this.onDatesSet.bind(this)
  };

  // Propiedades para el modal
  modalVisible: boolean = false;
  modalFecha: string = '';
  modalEventos: any[] = [];
  modalEventosFiltrados: any[] = [];
  modalBusqueda: string = '';

  constructor(
    private ordenService: OrdenService,
    private doctorService: DoctorService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}
  
  ngOnInit() {
    // ✅ Generar años (2016 - 2046)
    const yearActual = new Date().getFullYear();
   // ✅ Opción 2: 10 años atrás, 20 adelante (más amplio)
      for (let i = yearActual - 10; i <= yearActual + 20; i++) {
      this.anos.push(i);
      }
    
    // ✅ Sincronizar mesSeleccionado con el mes actual
    const fechaActual = new Date();
    this.mesSeleccionado = fechaActual.getMonth() + 1;
    this.anoSeleccionado = fechaActual.getFullYear();
    
    console.log('📆 Mes inicial:', this.mesSeleccionado, 'Año inicial:', this.anoSeleccionado);
    
    this.obtenerFechaHoraServidor();
    
    if (this.doctores.length === 0) {
      this.cargarDoctores();
    }
  }
  
  // ✅ NUEVO: Cambiar de mes
  onMesChange() {
    if (this.actualizandoSelects) return;
    console.log('📆 Mes cambiado a:', this.mesSeleccionado);
    this.irAMesAno(this.mesSeleccionado, this.anoSeleccionado);
  }
  
  // ✅ NUEVO: Cambiar de año
  onAnoChange() {
    if (this.actualizandoSelects) return;
    console.log('📅 Año cambiado a:', this.anoSeleccionado);
    this.irAMesAno(this.mesSeleccionado, this.anoSeleccionado);
  }
  
  // ✅ NUEVO: Ir a un mes y año específico
  irAMesAno(mes: number, ano: number) {
    if (this.calendarApi) {
      const fecha = new Date(ano, mes - 1, 1);
      this.calendarApi.gotoDate(fecha);
      
      // Actualizar los selects
      this.actualizandoSelects = true;
      this.mesSeleccionado = mes;
      this.anoSeleccionado = ano;
      this.actualizandoSelects = false;
      
      // Actualizar los filtros
      this.filtrosAplicados.emit({
        doctor_id: this.doctorSeleccionado?.id || null,
        tipo_fecha: this.tipoFecha,
        estado: this.estadoSeleccionado,
        mes: mes,
        ano: ano
      });
    }
  }
  
  // Callback cuando cambia el mes en el calendario
  onDatesSet(info: any) {
    // ✅ Actualizar los selects de mes y año para que coincidan con el calendario
    const fechaActual = info.view.currentStart;
    const mes = fechaActual.getMonth() + 1;
    const ano = fechaActual.getFullYear();
    
    console.log('📆 Calendario cambió a:', mes, ano);
    
    // ✅ Actualizar selects SIN disparar eventos
    this.actualizandoSelects = true;
    this.mesSeleccionado = mes;
    this.anoSeleccionado = ano;
    this.actualizandoSelects = false;
    
    this.navegando = true;
    
    this.filtrosAplicados.emit({
      doctor_id: this.doctorSeleccionado?.id || null,
      tipo_fecha: this.tipoFecha,
      estado: this.estadoSeleccionado,
      mes: mes,
      ano: ano
    });
    
    setTimeout(() => {
      this.navegando = false;
    }, 300);
  }
  
  obtenerFechaHoraServidor() {
    this.subscriptions.push(
      this.ordenService.getFechaHoraServidor().subscribe({
        next: (respuesta) => {
          this.fechaHoraActual = new Date(respuesta.timestamp);
          console.log('🕐 Calendario - Fecha/hora servidor:', this.fechaHoraActual.toLocaleString('es-PE'));
        },
        error: (error) => {
          console.error('Error obteniendo fecha/hora del servidor:', error);
          this.fechaHoraActual = new Date();
          console.log('🕐 Calendario - Usando fecha local:', this.fechaHoraActual.toLocaleString('es-PE'));
        }
      })
    );
  }
  
  ngAfterViewInit() {
    this.cdr.detectChanges();
    if (this.fullCalendar) {
      this.calendarApi = this.fullCalendar.getApi();
      
      // ✅ Forzar sincronización inicial
      setTimeout(() => {
        const fechaActual = this.calendarApi.getDate();
        const mes = fechaActual.getMonth() + 1;
        const ano = fechaActual.getFullYear();
        this.actualizandoSelects = true;
        this.mesSeleccionado = mes;
        this.anoSeleccionado = ano;
        this.actualizandoSelects = false;
        this.cdr.detectChanges();
        console.log('📆 Sincronización inicial - Mes:', mes, 'Año:', ano);
      }, 100);
    }
  }

  compararDoctores(d1: any, d2: any): boolean {
    return d1 && d2 && d1.id === d2.id;
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

  cargarEventos(info: any, successCallback: any, failureCallback: any) {
    const fechaInicio = info.startStr.split('T')[0];
    const fechaFin = info.endStr.split('T')[0];
    
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
    
    const doctorId = this.doctorSeleccionado?.id || 'todos';
    console.log('📅 Cargando eventos - Doctor:', doctorId, 'Fechas:', fechaInicio, '-', fechaFin);
    
    this.subscriptions.push(
      this.ordenService.getOrdenesConFiltros({
        doctor_id: doctorId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo_fecha: this.tipoFecha,
        estado: this.estadoSeleccionado
      }).subscribe({
        next: (ordenes) => {
          console.log(`📊 Eventos encontrados: ${ordenes?.length || 0}`);
          if (!ordenes || !Array.isArray(ordenes)) {
            successCallback([]);
            return;
          }
          
          const eventos: any[] = [];
          const ahora = this.fechaHoraActual || new Date();
          console.log('🕐 Fecha actual para colores:', ahora.toLocaleString('es-PE'));
          
          ordenes.forEach(orden => {
            if (orden.detalles && orden.detalles.length > 0) {
              orden.detalles.forEach((detalle: any) => {
                let fechaEvento = null;
                
                if (this.tipoFecha === 'limite') {
                  fechaEvento = detalle.fecha_limite;
                } else {
                  fechaEvento = orden.fecha_registro?.split('T')[0];
                }
                
                if (!fechaEvento) return;
                
                let color = '#6366f1'; // Morado: Normal
                
                if (orden.estado === 'terminado') {
                  color = '#10b981'; // 🟢 Verde: Terminado / Pagado
                }
                else if (this.tipoFecha === 'limite' && detalle.fecha_limite) {
                  const [yearL, monthL, dayL] = detalle.fecha_limite.split('-').map(Number);
                  let hora = 23, minutos = 59, segundos = 59;
                  
                  if (detalle.hora_limite) {
                    const horaParts = detalle.hora_limite.split(':');
                    hora = parseInt(horaParts[0]);
                    minutos = parseInt(horaParts[1]);
                    segundos = 0;
                  }
                  
                  const fechaLimiteCompleta = new Date(yearL, monthL - 1, dayL, hora, minutos, segundos);
                  
                  if (ahora.getTime() > fechaLimiteCompleta.getTime()) {
                    color = '#f43f5e'; // 🔴 Rojo: Vencido
                  }
                  else if (fechaLimiteCompleta.getTime() - ahora.getTime() < 48 * 60 * 60 * 1000) {
                    color = '#f59e0b'; // 🟡 Amarillo: Próximo a vencer
                  }
                }
                
                const doctorNombre = orden.doctor?.nombre?.substring(0, 20) || 'Sin doctor';
                const servicioNombre = detalle.servicio?.nombre?.substring(0, 25) || 'Sin servicio';
                let title = `${doctorNombre} - ${servicioNombre}`;
                
                if (title.length > 35) {
                  title = title.substring(0, 32) + '...';
                }
                
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
                    servicio: detalle.servicio,
                    hora: detalle.hora_limite || null
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
    const fechaStr = event.dateStr;
    console.log('📅 Clic en fecha:', fechaStr);
    
    const eventos = this.calendarApi?.getEvents();
    
    const eventosFecha = eventos?.filter((e: any) => {
      const startStr = e.startStr?.split('T')[0];
      return startStr === fechaStr;
    }) || [];
    
    console.log(`📊 Eventos en ${fechaStr}: ${eventosFecha.length}`);
    
    if (eventosFecha.length === 0) {
      this.filtrosAplicados.emit({
        fecha_inicio: fechaStr,
        fecha_fin: fechaStr,
        tipo_fecha: this.tipoFecha,
        doctor_id: this.doctorSeleccionado?.id || null
      });
      return;
    }
    
    this.modalEventos = eventosFecha.map((e: any) => e.toPlainObject());
    this.modalEventosFiltrados = [...this.modalEventos];
    
    const fechaObj = new Date(fechaStr + 'T00:00:00');
    this.modalFecha = fechaObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Lima'
    });
    
    this.modalBusqueda = '';
    this.modalVisible = true;
    
    this.filtrosAplicados.emit({
      fecha_inicio: fechaStr,
      fecha_fin: fechaStr,
      tipo_fecha: this.tipoFecha,
      doctor_id: this.doctorSeleccionado?.id || null
    });
  }

  filtrarModalEventos() {
    const busqueda = this.modalBusqueda.toLowerCase().trim();
    if (!busqueda) {
      this.modalEventosFiltrados = [...this.modalEventos];
      return;
    }
    this.modalEventosFiltrados = this.modalEventos.filter((e: any) => {
      const title = e.title?.toLowerCase() || '';
      const doctor = e.extendedProps?.doctor?.nombre?.toLowerCase() || '';
      const servicio = e.extendedProps?.servicio?.nombre?.toLowerCase() || '';
      const cliente = e.extendedProps?.orden?.cliente_nombre?.toLowerCase() || '';
      return title.includes(busqueda) || 
             doctor.includes(busqueda) || 
             servicio.includes(busqueda) || 
             cliente.includes(busqueda);
    });
  }

  cerrarModal() {
    this.modalVisible = false;
    this.modalEventos = [];
    this.modalEventosFiltrados = [];
    this.modalBusqueda = '';
  }

  irADetalle(evento: any) {
    const ordenId = evento.id?.split('-')[0];
    if (ordenId && !isNaN(parseInt(ordenId))) {
      this.cerrarModal();
      this.router.navigate(['/ordenes', ordenId]);
    }
  }

  onEventClick(event: any) {
    const eventId = event.event.id;
    if (eventId) {
      const ordenId = eventId.split('-')[0];
      if (ordenId && !isNaN(parseInt(ordenId))) {
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

  onDoctorSeleccionado(doctor: any) {
    console.log('👨‍⚕️ Doctor seleccionado:', doctor?.nombre || 'Todos');
    this.doctorSeleccionado = doctor;
    this.aplicarFiltros();
  }

  aplicarFiltros() {
    console.log('🔍 Aplicando filtros - Doctor seleccionado:', this.doctorSeleccionado?.id || 'Todos');
    
    if (this.calendarApi) {
      this.calendarApi.refetchEvents();
    }
    
    this.filtrosAplicados.emit({
      doctor_id: this.doctorSeleccionado?.id || null,
      tipo_fecha: this.tipoFecha,
      estado: this.estadoSeleccionado,
      mes: this.mesSeleccionado,
      ano: this.anoSeleccionado
    });
  }
  
  limpiarFiltros() {
    const fechaActual = new Date();
    this.doctorSeleccionado = null;
    this.tipoFecha = 'limite';
    this.estadoSeleccionado = 'todos';
    
    // ✅ Sincronizar con la fecha actual
    this.actualizandoSelects = true;
    this.mesSeleccionado = fechaActual.getMonth() + 1;
    this.anoSeleccionado = fechaActual.getFullYear();
    this.actualizandoSelects = false;
    
    if (this.calendarApi) {
      this.calendarApi.gotoDate(fechaActual);
      this.calendarApi.refetchEvents();
    }
    
    this.filtrosAplicados.emit({
      doctor_id: null,
      tipo_fecha: this.tipoFecha,
      estado: 'todos',
      mes: this.mesSeleccionado,
      ano: this.anoSeleccionado
    });
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}