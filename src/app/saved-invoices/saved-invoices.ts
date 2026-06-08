import { Component, computed, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { invoiceTotal, SavedInvoice } from '../invoice.model';
import { InvoiceStore } from '../invoice-store';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-saved-invoices',
  imports: [DecimalPipe, DatePipe, RouterLink, LucideAngularModule],
  templateUrl: './saved-invoices.html'
})
export class SavedInvoices {
  private store = inject(InvoiceStore);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly invoices = this.store.invoices;
  readonly count = computed(() => this.invoices().length);

  total = invoiceTotal;

  trackById(_: number, inv: SavedInvoice): string {
    return inv.id;
  }

  edit(inv: SavedInvoice): void {
    this.router.navigate(['/edit', inv.id]);
  }

  remove(inv: SavedInvoice): void {
    if (!confirm(`Delete invoice "${inv.invoiceNumber || 'Untitled'}"?`)) return;
    this.store.remove(inv.id);
    this.toast.show('Invoice deleted');
  }

  // ---- Backup / transfer ----
  exportInvoices(): void {
    if (!this.count()) {
      this.toast.show('Nothing to export yet');
      return;
    }
    const blob = new Blob([this.store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-backup-${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.toast.show(`Exported ${this.count()} invoice(s)`);
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const res = this.store.importData(await file.text());
      this.toast.show(
        res.added || res.updated
          ? `Imported — ${res.added} added, ${res.updated} updated`
          : 'Already up to date — nothing new'
      );
    } catch {
      this.toast.show('Could not import — invalid backup file');
    } finally {
      input.value = ''; // allow re-importing the same file
    }
  }
}
