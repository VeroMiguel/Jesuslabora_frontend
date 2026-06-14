// main.ts - Limpiar Service Workers antiguos en desarrollo
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';
import { DebugService, setupDebugCommands } from './app/core/services/debug.service';
import { environment } from './environments/environment';

async function clearOldServiceWorkers() {
    if (!environment.production && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
            console.log('🗑️ Service Worker desregistrado:', registration.scope);
        }
    }
}

async function bootstrap() {
    // ✅ Limpiar SW antiguos antes de iniciar
    await clearOldServiceWorkers();
    
    bootstrapApplication(AppComponent, appConfig)
        .then(() => {
            const debugService = new DebugService();
            setupDebugCommands(debugService);
            console.log('✅ Sistema inicializado correctamente');
        })
        .catch((err) => console.error(err));
}

bootstrap();