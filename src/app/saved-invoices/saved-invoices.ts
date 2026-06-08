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
}
