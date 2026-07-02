// whatsapp.service.ts - VERSIÓN ACTUALIZADA PARA DETALLES_ORDEN

import { Injectable, Injector } from '@angular/core';
import Swal from 'sweetalert2';
import { MonedaPipe } from '../../shared/pipes/moneda.pipe';

export interface WhatsAppOptions {
  telefono: string;
  nombre: string;
  tipo: 'doctor' | 'orden';
  datos: any;
}

@Injectable({
  providedIn: 'root'
})
export class WhatsAppService {
  private monedaPipe: MonedaPipe;

  constructor(private injector: Injector) {
    this.monedaPipe = new MonedaPipe();
  }

  enviarMensajePersonalizado(options: WhatsAppOptions) {
    if (!options.telefono) {
      Swal.fire('Error', 'No hay número de teléfono registrado', 'error');
      return;
    }

    let mensajePredefinido = '';

    if (options.tipo === 'doctor') {
      mensajePredefinido = this.generarMensajeDoctor(options.datos);
    } else if (options.tipo === 'orden') {
      mensajePredefinido = this.generarMensajeOrden(options.datos);
    }

    Swal.fire({
      title: 'Personalizar mensaje',
      html: `
        <div class="whatsapp-modal">
          <textarea id="mensaje-whatsapp" class="whatsapp-textarea" 
                    placeholder="Escribe tu mensaje..." 
                    style="min-height: 200px;">${mensajePredefinido}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fab fa-whatsapp"></i> Enviar por WhatsApp',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#25D366',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'whatsapp-popup',
        confirmButton: 'btn-whatsapp-confirm',
        cancelButton: 'btn-cancel'
      },
      preConfirm: () => {
        const mensaje = (document.getElementById('mensaje-whatsapp') as HTMLTextAreaElement).value;
        if (!mensaje || mensaje.trim() === '') {
          Swal.showValidationMessage('El mensaje no puede estar vacío');
          return false;
        }
        return mensaje;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const telefonoLimpio = options.telefono.replace(/\D/g, '');
        this.abrirWhatsAppConMensaje(telefonoLimpio, result.value);
      }
    });
  }

  private abrirWhatsAppConMensaje(numeroTelefono: string, mensaje: string): void {
    const mensajeLimpio = mensaje.normalize('NFC');
    const mensajeCodificado = encodeURIComponent(mensajeLimpio);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${numeroTelefono}&text=${mensajeCodificado}`;
    console.log('📤 Abriendo WhatsApp en nueva pestaña');
    window.open(whatsappUrl, '_blank');
  }

// whatsapp.service.ts - REEMPLAZAR generarMensajeDoctor

private generarMensajeDoctor(doctor: any): string {
  // ✅ Obtener órdenes del doctor
  const ordenes = doctor.ordenes || [];
  const totalOrdenes = ordenes.length;
  const pendientes = ordenes.filter((o: any) => o.estado === 'pendiente').length || 0;
  
  // ✅ Calcular deuda total usando saldo (que ya incluye pagos)
  let deudaTotal = 0;
  for (const orden of ordenes) {
    // ✅ Usar saldo directamente (viene del backend)
    const saldo = Number(orden.saldo) || 0;
    deudaTotal += saldo;
  }

  return `Hola Dr(a). ${doctor.nombre}, le informo sobre su cuenta:

📊 *RESUMEN DE CUENTA*
━━━━━━━━━━━━━━━━━━
• Total órdenes: ${totalOrdenes}
• Pendientes: ${pendientes}
• Deuda total: ${this.monedaPipe.transform(deudaTotal)}
━━━━━━━━━━━━━━━━━━

Saludos cordiales.`;
}

  /**
   * ✅ Genera mensaje de orden usando detalles_orden
   */
// whatsapp.service.ts - REEMPLAZAR COMPLETAMENTE generarMensajeOrden

private generarMensajeOrden(orden: any): string {
  const totalPagado = orden.pagos?.reduce((sum: number, p: any) => sum + Number(p.monto), 0) || 0;
  const saldo = Number(orden.total) - totalPagado;
  const detalles = orden.detalles || [];

  // ✅ Si la orden ya tiene cliente_nombre, usarlo (para cliente único)
  let clienteGlobal = orden.cliente_nombre;

  // ✅ Si solo hay un detalle, usar su cliente
  if (detalles.length === 1 && !clienteGlobal) {
    clienteGlobal = detalles[0].cliente_nombre;
  }

  // ✅ Construir servicios
  let serviciosTexto = '';
  let fechasLimiteTexto = '';

  if (detalles.length > 0) {
    const serviciosLista = detalles.map((d: any, i: number) => {
      const nombre = d.servicio?.nombre || 'Sin servicio';
      const precio = this.monedaPipe.transform(d.precio_unitario);
      const cantidad = d.cantidad || 1;
      const cliente = d.cliente_nombre || orden.cliente_nombre || 'No especificado';
      return `   ${i + 1}. ${nombre} x${cantidad} = ${precio} (${cliente})`;
    }).join('\n');
    serviciosTexto = `\n📋 *SERVICIOS*\n${serviciosLista}`;

    // ✅ Fechas límite - USAR formatearFecha CORRECTAMENTE
    const fechasLista = detalles.map((d: any) => {
      const fecha = d.fecha_limite ? this.formatearFecha(d.fecha_limite) : 'Sin fecha';
      const hora = d.hora_limite ? this.formatearHora(d.hora_limite) : '';
      const nombre = d.servicio?.nombre || 'Sin servicio';
      return `   • ${nombre}: ${fecha} ${hora}`;
    }).join('\n');
    fechasLimiteTexto = `\n⏰ *FECHAS LÍMITE*\n${fechasLista}`;
  }

  // ✅ Clientes (usar el cliente global si existe)
  let clientesTexto = clienteGlobal || 'No especificado';
  if (!clienteGlobal && detalles.length > 0) {
    const clientesUnicos = [...new Set(detalles.map((d: any) => d.cliente_nombre || 'No especificado'))];
    clientesTexto = clientesUnicos.join(', ');
  }

  // ✅ Historial de pagos
  let historialPagos = '';
  if (orden.pagos && orden.pagos.length > 0) {
    const pagosOrdenados = [...orden.pagos].sort((a, b) => 
      new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    );
    
    historialPagos = '\n\n📆 *HISTORIAL DE PAGOS*\n';
    historialPagos += '━━━━━━━━━━━━━━━━━━\n';
    
    pagosOrdenados.forEach((pago: any, index: number) => {
      const fecha = new Date(pago.creado_en).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      historialPagos += `${index + 1}. ${fecha}\n`;
      historialPagos += `   💰 ${this.monedaPipe.transform(pago.monto)} - ${pago.metodo_pago}\n`;
      if (pago.referencia) {
        historialPagos += `   📝 Ref: ${pago.referencia}\n`;
      }
    });
    
    historialPagos += '━━━━━━━━━━━━━━━━━━';
  }

  // ✅ Construir mensaje final
  return `Hola Dr(a). ${orden.doctor?.nombre}, le comparto el estado de su trabajo:

📋 *DETALLE DE LA ORDEN #${orden.id_externo}*
━━━━━━━━━━━━━━━━━━
• Total: ${this.monedaPipe.transform(orden.total)}
• Abonado: ${this.monedaPipe.transform(totalPagado)}
• Saldo: ${this.monedaPipe.transform(saldo)}
• Clientes: ${clientesTexto}
${serviciosTexto}
${fechasLimiteTexto}
━━━━━━━━━━━━━━━━━━${historialPagos}

Gracias por su preferencia.`;
}

/**
 * ✅ Formatea fecha correctamente (sin offset de zona horaria)
 */
private formatearFecha(value: string | Date): string {
  if (!value) return '';
  
  // Detectar si es fecha pura (YYYY-MM-DD)
  const esFechaPura = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  
  let fecha: Date;
  let usarUTC = false;
  
  if (esFechaPura) {
    const [year, month, day] = value.split('-').map(Number);
    fecha = new Date(Date.UTC(year, month - 1, day));
    usarUTC = true;
  } else {
    fecha = new Date(value);
    usarUTC = false;
  }
  
  if (isNaN(fecha.getTime())) return '';
  
  const getDia = () => usarUTC ? fecha.getUTCDate() : fecha.getDate();
  const getMes = () => usarUTC ? fecha.getUTCMonth() + 1 : fecha.getMonth() + 1;
  const getAño = () => usarUTC ? fecha.getUTCFullYear() : fecha.getFullYear();
  
  const dia = getDia().toString().padStart(2, '0');
  const mes = getMes().toString().padStart(2, '0');
  const año = getAño();
  
  return `${dia}/${mes}/${año}`;
}

  private formatearHora(hora: string): string {
    if (!hora) return '';
    const match = hora.match(/^(\d{2}):(\d{2})/);
    if (match) {
      const horas = parseInt(match[1]);
      const minutos = match[2];
      const ampm = horas >= 12 ? 'PM' : 'AM';
      const horas12 = horas % 12 || 12;
      return `${horas12}:${minutos} ${ampm}`;
    }
    return hora;
  }
}