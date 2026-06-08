import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode,
  importProvidersFrom
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import {
  LucideAngularModule,
  Save,
  FileText,
  Share2,
  Printer,
  FilePlus,
  Plus,
  Trash2,
  SquarePen,
  FolderOpen,
  ChevronDown,
  Download,
  UserRoundPlus
} from 'lucide-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    importProvidersFrom(
      LucideAngularModule.pick({
        Save,
        FileText,
        Share2,
        Printer,
        FilePlus,
        Plus,
        Trash2,
        SquarePen,
        FolderOpen,
        ChevronDown,
        Download,
        UserRoundPlus
      })
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
