// imagen.pipe.ts - Versión mejorada
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
    
    if (value.startsWith('http')) {
      return value;
    }
    
    if (value.startsWith('data:')) {
      return value;
    }
    
    const baseUrl = environment.apiUrl.replace('/api', '');
    const fullUrl = `${baseUrl}${value}`;
    
    // ✅ Log solo si debug está activado y no es producción
    if (!environment.production && this.debugService?.logImages) {
      console.log('🖼️ Imagen:', value.substring(value.lastIndexOf('/') + 1));
    }
    
    return fullUrl;
  }
}