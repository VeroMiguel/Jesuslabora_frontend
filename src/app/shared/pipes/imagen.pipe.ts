// imagen.pipe.ts - VERSIÓN CORREGIDA
import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DebugService } from '../../core/services/debug.service';

@Pipe({
  name: 'imagen',
  standalone: true
})
export class ImagenPipe implements PipeTransform {
  constructor(private debugService?: DebugService) {}
  
  transform(value: string, defaultImage: string = 'assets/images/default-doctor.png'): string {
    if (!value) {
      return defaultImage;
    }
    
    // ✅ Si ya es una URL completa, devolverla
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    
    // ✅ Si es base64, devolverlo
    if (value.startsWith('data:')) {
      return value;
    }
    
    // ✅ Construir URL completa correctamente
    // El backend guarda rutas como "/uploads/detalles/archivo.jpg"
    // Necesitamos usar baseUrl (sin /api)
    const baseUrl = environment.apiUrl.replace('/api', '');
    const fullUrl = `${baseUrl}${value}`;
    
    // ✅ Log solo para depuración
    if (!environment.production && this.debugService?.logImages) {
      console.log('🖼️ Imagen pipe:', value, '→', fullUrl);
    }
    
    return fullUrl;
  }
}