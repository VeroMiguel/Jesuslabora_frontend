// login.component.ts - Agregar logo service
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LogoService } from '../../core/services/logo.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;
  logoUrl: string | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private logoService: LogoService
  ) {
    this.loginForm = this.fb.group({
      nombre_usuario: ['', Validators.required],
      contrasena: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.subscriptions.push(
      this.logoService.logo$.subscribe(url => {
        this.logoUrl = url;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onSubmit() {
    if (this.loginForm.valid && !this.isLoading) {
      this.isLoading = true;
      
      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Error de autenticación',
            text: error.error?.error || 'Credenciales inválidas',
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonColor: '#6366f1'
          });
        }
      });
    } else {
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
    }
  }
}