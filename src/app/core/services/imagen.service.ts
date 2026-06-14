import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImagenService {
  private baseUrl = environment.apiUrl.replace('/api', '');
  
  getUrlCompleta(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${this.baseUrl}${url}`;
  }
  
  abrirImagen(url: string, titulo: string = 'Imagen'): void {
    const urlCompleta = this.getUrlCompleta(url);
    window.open(urlCompleta, '_blank');
  }
}