import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import {AppComponent} from './app/app';
import { DebugService, setupDebugCommands } from './app/core/services/debug.service';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // Inicializar sistema de debug
    const debugService = new DebugService();
    setupDebugCommands(debugService);
    console.log('✅ Sistema inicializado correctamente');
  })
  .catch((err) => console.error(err));
