import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { DoctorService } from '../../../../core/services/doctor.service';
import Swal from 'sweetalert2';
import { ImagenPipe } from '../../../../shared/pipes/imagen.pipe';

@Component({
  selector: 'app-doctor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ImagenPipe],
  templateUrl: './doctor-form.component.html',
  styleUrls: ['./doctor-form.component.css']
})
export class DoctorFormComponent implements OnInit, OnDestroy {
  doctorForm: FormGroup;
  esEdicion = false;
  doctorId?: number;
  imagenPreview?: string;
  archivoSeleccionado?: File;
  private subscriptions: Subscription[] = [];

  // Validador personalizado para número de teléfono
  static telefonoValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) {
      return { required: true };
    }
    // Validar que solo contenga números y tenga entre 10 y 15 dígitos
    const phoneRegex = /^\d{9,11}$/;
    if (!phoneRegex.test(value)) {
      return { invalidPhone: true };
    }
    return null;
  }

  constructor(
    private fb: FormBuilder,
    private doctorService: DoctorService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.doctorForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      telefono_whatsapp: ['', [Validators.required, DoctorFormComponent.telefonoValidator]],
      direccion: ['']
    });
  }

  ngOnInit() {
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        if (params['id']) {
          this.esEdicion = true;
          this.doctorId = +params['id'];
          this.cargarDoctor();
        }
      })
    );
  }

  cargarDoctor() {
    if (this.doctorId) {
      this.subscriptions.push(
        this.doctorService.getDoctor(this.doctorId).subscribe({
          next: (doctor) => {
            this.doctorForm.patchValue(doctor);
            if (doctor.logo_url) {
              this.imagenPreview = doctor.logo_url;
            }
            // Si el doctor existente tiene teléfono, mantenerlo
          },
          error: (error) => {
            console.error('Error cargando doctor:', error);
            Swal.fire('Error', 'No se pudo cargar el doctor', 'error');
          }
        })
      );
    }
  }

  onFileSelected(event: any) {
    this.archivoSeleccionado = event.target.files[0];
    if (this.archivoSeleccionado) {
      if (this.archivoSeleccionado.size > 15 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Imagen muy grande',
          text: 'La imagen no puede superar los 15MB',
          confirmButtonColor: '#f43f5e'
        });
        this.archivoSeleccionado = undefined;
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(this.archivoSeleccionado.type)) {
        Swal.fire({
          icon: 'error',
          title: 'Formato no soportado',
          text: 'Formatos permitidos: JPG, PNG, GIF, WEBP, AVIF, HEIC',
          confirmButtonColor: '#f43f5e'
        });
        this.archivoSeleccionado = undefined;
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => this.imagenPreview = e.target?.result as string;
      reader.readAsDataURL(this.archivoSeleccionado);
    }
  }

  // Método auxiliar para obtener mensajes de error del teléfono
  getTelefonoErrorMessage(): string {
    const control = this.doctorForm.get('telefono_whatsapp');
    if (control?.hasError('required')) {
      return 'El número de teléfono es obligatorio';
    }
    if (control?.hasError('invalidPhone')) {
      return 'Ingrese un número válido (solo números, 9-11 dígitos)';
    }
    return '';
  }

  onSubmit() {
    // Marcar todos los campos como tocados para mostrar errores
    if (this.doctorForm.invalid) {
      this.doctorForm.markAllAsTouched();
      
      // Mostrar mensaje específico si falta el teléfono
      if (this.doctorForm.get('telefono_whatsapp')?.hasError('required')) {
        Swal.fire({
          icon: 'warning',
          title: 'Campos incompletos',
          text: 'El número de teléfono WhatsApp es obligatorio',
          confirmButtonColor: '#f43f5e'
        });
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Campos incompletos',
          text: 'Por favor complete todos los campos obligatorios',
          confirmButtonColor: '#f43f5e'
        });
      }
      return;
    }

    const formData = new FormData();
    
    Object.keys(this.doctorForm.value).forEach(key => {
      const value = this.doctorForm.value[key];
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    if (this.archivoSeleccionado) {
      formData.append('logo', this.archivoSeleccionado);
    }

    if (this.esEdicion && this.doctorId) {
      this.subscriptions.push(
        this.doctorService.actualizarDoctor(this.doctorId, formData).subscribe({
          next: () => {
            Swal.fire('¡Éxito!', 'Doctor actualizado correctamente', 'success');
            this.router.navigate(['/doctores']);
          },
          error: (error) => {
            console.error('Error actualizando doctor:', error);
            this.handleErrorResponse(error);
          }
        })
      );
    } else {
      this.subscriptions.push(
        this.doctorService.crearDoctor(formData).subscribe({
          next: () => {
            Swal.fire('¡Éxito!', 'Doctor creado correctamente', 'success');
            this.router.navigate(['/doctores']);
          },
          error: (error) => {
            console.error('Error creando doctor:', error);
            this.handleErrorResponse(error);
          }
        })
      );
    }
  }

  private handleErrorResponse(error: any) {
    let errorMessage = 'No se pudo completar la operación';
    
    if (error.status === 400) {
      // Intentar extraer mensaje de error del backend
      if (error.error && typeof error.error === 'object') {
        if (error.error.message) {
          errorMessage = error.error.message;
        } else if (error.error.telefono_whatsapp) {
          errorMessage = 'Error en el número de teléfono: ' + error.error.telefono_whatsapp;
        } else if (error.error.nombre) {
          errorMessage = 'Error en el nombre: ' + error.error.nombre;
        } else {
          errorMessage = 'Error en los datos enviados. Verifique el número de teléfono';
        }
      } else {
        errorMessage = 'El número de teléfono es obligatorio y debe ser válido';
      }
    }
    
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: errorMessage,
      confirmButtonColor: '#f43f5e'
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    console.log('🧹 DoctorFormComponent destruido');
  }
}