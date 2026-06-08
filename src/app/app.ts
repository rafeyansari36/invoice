import { Component, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { InvoiceStore } from './invoice-store';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private store = inject(InvoiceStore);
  private toast = inject(ToastService);

  /** Saved invoice count, shown as a badge on the nav. */
  readonly savedCount = this.store.invoices;
  /** Toast message driven by ToastService. */
  readonly toastMessage = this.toast.message;

  /** PWA install */
  canInstall = false;
  private deferredPrompt: any = null;

  // ---- PWA install ----
  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstall(event: Event): void {
    event.preventDefault();
    this.deferredPrompt = event;
    this.canInstall = true;
  }

  @HostListener('window:appinstalled')
  onAppInstalled(): void {
    this.deferredPrompt = null;
    this.canInstall = false;
    this.toast.show('App installed');
  }

  async installApp(): Promise<void> {
    if (!this.deferredPrompt) {
      this.toast.show('Use your browser menu → "Add to Home screen"');
      return;
    }
    this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall = false;
  }
}
