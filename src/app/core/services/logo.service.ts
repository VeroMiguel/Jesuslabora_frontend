// core/services/logo.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LogoService {
  private apiUrl = `${environment.apiUrl}/configuracion/logo`;
  private logoSubject = new BehaviorSubject<string | null>(null);
  public logo$ = this.logoSubject.asObservable();

  constructor(private http: HttpClient) {
    this.cargarLogo();
  }

  cargarLogo(): void {
    // ✅ GET es público, no necesita token
    this.http.get<{ logo_url: string | null }>(this.apiUrl)
      .pipe(
        catchError((error) => {
          console.error('Error cargando logo:', error);
          return of({ logo_url: null });
        })
      )
      .subscribe({
        next: (resp) => {
          if (resp?.logo_url) {
            const baseUrl = environment.apiUrl.replace('/api', '');
            this.logoSubject.next(`${baseUrl}${resp.logo_url}`);
          } else {
            this.logoSubject.next(null);
          }
        }
      });
  }

  subirLogo(logo: File): Observable<any> {
    const formData = new FormData();
    formData.append('logo', logo);
    return this.http.post(this.apiUrl, formData);
  }

  eliminarLogo(): Observable<any> {
    return this.http.delete(this.apiUrl);
  }

  getLogoUrl(): string | null {
    return this.logoSubject.value;
  }

  recargarLogo(): void {
    this.cargarLogo();
  }
}