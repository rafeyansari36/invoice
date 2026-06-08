import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { jsPDF } from 'jspdf';
import { DEFAULT_BUSINESS, InvoiceData, Product } from '../invoice.model';
import { InvoiceStore } from '../invoice-store';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-invoice-editor',
  imports: [FormsModule, DecimalPipe, LucideAngularModule],
  templateUrl: './invoice-editor.html'
})
export class InvoiceEditor {
  private store = inject(InvoiceStore);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Seller / your details */
  businessName = DEFAULT_BUSINESS.businessName;
  ownerName = DEFAULT_BUSINESS.ownerName;
  businessPhone = DEFAULT_BUSINESS.businessPhone;

  /** Customer details */
  customerName = '';
  customerPhone = '';

  /** Invoice meta */
  private createdStamp = this.timeStamp();
  invoiceNumber = this.composeInvoiceNumber();
  invoiceDate = new Date().toISOString().substring(0, 10);

  /** Line items */
  products: Product[] = [{ name: '', quantity: 1, mrp: 0 }];

  /** id of the saved invoice currently loaded in the form, if any */
  currentId: string | null = null;

  /** Whether the device exposes the Contact Picker API */
  canPickContacts = this.contactPickerSupported();

  constructor() {
    // When routed to /edit/:id, load that invoice into the form.
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const inv = this.store.getById(id);
      if (inv) this.loadInvoice(inv);
    }
  }

  private loadInvoice(inv: InvoiceData & { id?: string }): void {
    this.businessName = inv.businessName ?? DEFAULT_BUSINESS.businessName;
    this.ownerName = inv.ownerName ?? DEFAULT_BUSINESS.ownerName;
    this.businessPhone = inv.businessPhone ?? DEFAULT_BUSINESS.businessPhone;
    this.customerName = inv.customerName ?? '';
    this.customerPhone = inv.customerPhone ?? '';
    this.invoiceNumber = inv.invoiceNumber ?? this.composeInvoiceNumber();
    this.invoiceDate = inv.invoiceDate ?? new Date().toISOString().substring(0, 10);
    this.products =
      Array.isArray(inv.products) && inv.products.length
        ? inv.products.map((p) => ({ ...p }))
        : [{ name: '', quantity: 1, mrp: 0 }];
    this.currentId = inv.id ?? null;
  }

  // ---- Contacts ----
  private contactPickerSupported(): boolean {
    const nav = navigator as any;
    return !!(nav.contacts && typeof nav.contacts.select === 'function');
  }

  /**
   * Let the user pick a customer from their device contacts.
   * The browser handles the access/permission prompt; if unsupported we
   * fall back to manual entry (the fields stay editable either way).
   */
  async pickContact(): Promise<void> {
    const nav = navigator as any;
    if (!this.contactPickerSupported()) {
      this.toast.show('Contact picker not available here — please type the details');
      return;
    }
    try {
      const contacts = await nav.contacts.select(['name', 'tel'], { multiple: false });
      if (!contacts || !contacts.length) return; // user cancelled
      const c = contacts[0];
      if (Array.isArray(c.name) && c.name.length) this.customerName = c.name[0];
      if (Array.isArray(c.tel) && c.tel.length) this.customerPhone = c.tel[0];
      this.refreshInvoiceNumber();
      this.toast.show('Contact added');
    } catch {
      /* user dismissed the picker or denied access */
    }
  }

  /** Re-derive the invoice number from the customer name + creation time. */
  onCustomerNameChange(): void {
    if (!this.currentId) this.refreshInvoiceNumber();
  }

  private refreshInvoiceNumber(): void {
    this.invoiceNumber = this.composeInvoiceNumber();
  }

  // ---- Line items ----
  addProduct(): void {
    this.products.push({ name: '', quantity: 1, mrp: 0 });
  }

  removeProduct(index: number): void {
    this.products.splice(index, 1);
    if (this.products.length === 0) {
      this.addProduct();
    }
  }

  lineTotal(p: Product): number {
    const qty = Number(p.quantity) || 0;
    const mrp = Number(p.mrp) || 0;
    return qty * mrp;
  }

  get totalQuantity(): number {
    return this.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  }

  get grandTotal(): number {
    return this.products.reduce((sum, p) => sum + this.lineTotal(p), 0);
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ---- Saving ----
  private snapshot(): InvoiceData {
    return {
      businessName: this.businessName,
      ownerName: this.ownerName,
      businessPhone: this.businessPhone,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      invoiceNumber: this.invoiceNumber,
      invoiceDate: this.invoiceDate,
      products: this.products.map((p) => ({ ...p }))
    };
  }

  /** True when the invoice has anything worth persisting. */
  private hasContent(): boolean {
    return this.customerName.trim().length > 0 || this.grandTotal > 0;
  }

  /** Persist the current form. Returns false if nothing was saved. */
  private persistCurrent(): boolean {
    const res = this.store.saveSnapshot(this.snapshot(), this.currentId);
    this.currentId = res.id;
    return res.ok;
  }

  save(): void {
    const wasEditing = !!this.currentId;
    const ok = this.persistCurrent();
    this.toast.show(ok ? (wasEditing ? 'Invoice updated' : 'Saved on this device') : 'Could not save');
  }

  /**
   * Auto-save before producing output so a user who downloads/shares
   * without pressing Save doesn't lose the invoice. No-op if empty.
   */
  private autoSave(): void {
    if (this.currentId || this.hasContent()) this.persistCurrent();
  }

  newInvoice(): void {
    if (
      this.hasContent() &&
      !confirm('Start a new invoice? Unsaved changes will be lost. (Your business details are kept.)')
    ) {
      return;
    }
    // Keep the business identity, clear the customer + items.
    this.customerName = '';
    this.customerPhone = '';
    this.createdStamp = this.timeStamp();
    this.invoiceNumber = this.composeInvoiceNumber();
    this.invoiceDate = new Date().toISOString().substring(0, 10);
    this.products = [{ name: '', quantity: 1, mrp: 0 }];
    this.currentId = null;
    this.toast.show('New invoice');
    // Drop the /edit/:id segment if present.
    this.router.navigate(['/']);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Output ----
  print(): void {
    this.autoSave();
    window.print();
  }

  private fileName(): string {
    const name = (this.customerName || 'invoice').trim() || 'invoice';
    const date = this.invoiceDate || new Date().toISOString().substring(0, 10);
    const safe = `${name}-${date}`.replace(/[^a-z0-9\-_]+/gi, '_');
    return `${safe}.pdf`;
  }

  private async buildPdf(): Promise<jsPDF> {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const money = (n: number) =>
      n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // --- Brand logo mark (drawn as vector) ---
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(margin, 28, 46, 46, 11, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text('N', margin + 23, 60, { align: 'center' });
    doc.setFillColor(251, 191, 36); // gold "light" accent
    doc.circle(margin + 38, 39, 4, 'F');

    // --- Wordmark ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text(this.businessName || 'Noori', margin + 58, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('BILLING MADE SIMPLE', margin + 59, 66);

    // --- INVOICE heading (right) ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text('INVOICE', pageWidth - margin, 48, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Invoice No: ${this.invoiceNumber || '-'}`, pageWidth - margin, 66, {
      align: 'right'
    });
    doc.text(`Date: ${this.invoiceDate || '-'}`, pageWidth - margin, 80, {
      align: 'right'
    });

    // --- From ---
    let y = 116;
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('FROM', margin, y);
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(this.businessName || '-', margin, (y += 16));
    if (this.ownerName) {
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(this.ownerName, margin, (y += 14));
    }
    if (this.businessPhone) {
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text('Ph: ' + this.businessPhone, margin, (y += 14));
    }

    // --- Bill To ---
    let by = 116;
    const billX = pageWidth - margin;
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('BILL TO', billX, by, { align: 'right' });
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(this.customerName || '-', billX, (by += 16), { align: 'right' });
    if (this.customerPhone) {
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text('Ph: ' + this.customerPhone, billX, (by += 14), { align: 'right' });
    }

    autoTable(doc, {
      startY: Math.max(y, by) + 24,
      margin: { left: margin, right: margin },
      head: [['#', 'Product', 'Qty', 'MRP', 'Total']],
      body: this.products.map((p, i) => [
        i + 1,
        p.name || '-',
        Number(p.quantity) || 0,
        money(Number(p.mrp) || 0),
        money(this.lineTotal(p))
      ]),
      foot: [['', 'Total', this.totalQuantity, '', money(this.grandTotal)]],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      footStyles: { fillColor: [243, 244, 246], textColor: 30, fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });

    const endY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text('Total Amount:', pageWidth - margin - 140, endY, { align: 'right' });
    doc.setTextColor(37, 99, 235);
    doc.text(`Rs. ${money(this.grandTotal)}`, pageWidth - margin, endY, {
      align: 'right'
    });

    return doc;
  }

  async downloadPdf(): Promise<void> {
    this.autoSave();
    const doc = await this.buildPdf();
    doc.save(this.fileName());
    this.toast.show('PDF downloaded');
  }

  async sharePdf(): Promise<void> {
    this.autoSave();
    const doc = await this.buildPdf();
    const blob = doc.output('blob');
    const file = new File([blob], this.fileName(), { type: 'application/pdf' });
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({
          files: [file],
          title: this.invoiceNumber || 'Invoice',
          text: `Invoice for ${this.customerName || 'customer'}`
        });
      } catch {
        /* user cancelled the share sheet */
      }
    } else {
      doc.save(this.fileName());
      this.toast.show('Sharing not supported here — PDF downloaded instead');
    }
  }

  // ---- Helpers ----
  /** A `YYYY-MM-DD HH:mm` stamp of the current local time. */
  private timeStamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}`
    );
  }

  /** Build the invoice number as "Customer Name - date time". */
  private composeInvoiceNumber(): string {
    const name = (this.customerName || '').trim();
    return name ? `${name} - ${this.createdStamp}` : this.createdStamp;
  }
}
