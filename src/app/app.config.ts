import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode,
  importProvidersFrom
} from '@angular/core';
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
  Download
} from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
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
        Download
      })
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
