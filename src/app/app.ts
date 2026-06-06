import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { jsPDF } from 'jspdf';

interface Product {
  name: string;
  quantity: number;
  mrp: number;
}

interface InvoiceData {
  businessName: string;
  ownerName: string;
  businessPhone: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  invoiceDate: string;
  products: Product[];
}

/** Default business identity (pre-filled into every new invoice). */
const DEFAULT_BUSINESS = {
  businessName: 'Noori',
  ownerName: 'Danish',
  businessPhone: '9762239565'
};

interface SavedInvoice extends InvoiceData {
  id: string;
  savedAt: number;
}

const LIST_KEY = 'invoice-maker.invoices';
const OLD_KEY = 'invoice-maker.invoice';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, DatePipe, LucideAngularModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  /** Seller / your details */
  businessName = DEFAULT_BUSINESS.businessName;
  ownerName = DEFAULT_BUSINESS.ownerName;
  businessPhone = DEFAULT_BUSINESS.businessPhone;

  /** Customer details */
  customerName = '';
  customerPhone = '';

  /** Invoice meta */
  invoiceNumber = this.nextInvoiceNumber();
  invoiceDate = new Date().toISOString().substring(0, 10);

  /** Line items */
  products: Product[] = [{ name: '', quantity: 1, mrp: 0 }];

  /** Saved invoices (history) */
  savedInvoices: SavedInvoice[] = [];
  /** id of the saved invoice currently loaded in the form, if any */
  currentId: string | null = null;
  showSaved = true;

  /** Transient UI state */
  toastMessage = '';
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** PWA install */
  canInstall = false;
  private deferredPrompt: any = null;

  constructor() {
    this.loadList();
  }

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
    this.showToast('App installed');
  }

  async installApp(): Promise<void> {
    if (!this.deferredPrompt) {
      this.showToast('Use your browser menu → "Add to Home screen"');
      return;
    }
    this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall = false;
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

  trackById(_: number, inv: SavedInvoice): string {
    return inv.id;
  }

  invoiceTotal(inv: InvoiceData): number {
    return (inv.products || []).reduce(
      (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.mrp) || 0),
      0
    );
  }

  // ---- Saved invoices: persistence ----
  private loadList(): void {
    try {
      const raw = localStorage.getItem(LIST_KEY);
      if (raw) {
        const list = JSON.parse(raw) as SavedInvoice[];
        if (Array.isArray(list)) this.savedInvoices = list;
      }
      // One-time migration from the old single-invoice storage
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const data = JSON.parse(old) as InvoiceData;
        this.savedInvoices.unshift({ ...data, id: this.newId(), savedAt: Date.now() });
        localStorage.removeItem(OLD_KEY);
        this.persistList();
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persistList(): boolean {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(this.savedInvoices));
      return true;
    } catch {
      return false;
    }
  }

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

  save(): void {
    const data = this.snapshot();
    const existing = this.currentId
      ? this.savedInvoices.find((i) => i.id === this.currentId)
      : undefined;

    if (existing) {
      Object.assign(existing, data, { savedAt: Date.now() });
      this.showToast(this.persistList() ? 'Invoice updated' : 'Could not save');
    } else {
      const id = this.newId();
      this.savedInvoices.unshift({ ...data, id, savedAt: Date.now() });
      this.currentId = id;
      this.showToast(this.persistList() ? 'Saved on this device' : 'Could not save');
    }
    this.showSaved = true;
  }

  editInvoice(inv: SavedInvoice): void {
    this.businessName = inv.businessName ?? DEFAULT_BUSINESS.businessName;
    this.ownerName = inv.ownerName ?? DEFAULT_BUSINESS.ownerName;
    this.businessPhone = inv.businessPhone ?? DEFAULT_BUSINESS.businessPhone;
    this.customerName = inv.customerName ?? '';
    this.customerPhone = inv.customerPhone ?? '';
    this.invoiceNumber = inv.invoiceNumber ?? this.nextInvoiceNumber();
    this.invoiceDate = inv.invoiceDate ?? new Date().toISOString().substring(0, 10);
    this.products =
      Array.isArray(inv.products) && inv.products.length
        ? inv.products.map((p) => ({ ...p }))
        : [{ name: '', quantity: 1, mrp: 0 }];
    this.currentId = inv.id;
    this.showToast('Editing — remember to Save');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteInvoice(inv: SavedInvoice): void {
    if (!confirm(`Delete invoice "${inv.invoiceNumber || 'Untitled'}"?`)) return;
    this.savedInvoices = this.savedInvoices.filter((i) => i.id !== inv.id);
    if (this.currentId === inv.id) this.currentId = null;
    this.persistList();
    this.showToast('Invoice deleted');
  }

  newInvoice(): void {
    if (
      (this.customerName || this.grandTotal > 0) &&
      !confirm('Start a new invoice? Unsaved changes will be lost. (Your business details are kept.)')
    ) {
      return;
    }
    // Keep the business identity, clear the customer + items.
    this.customerName = '';
    this.customerPhone = '';
    this.invoiceNumber = this.nextInvoiceNumber();
    this.invoiceDate = new Date().toISOString().substring(0, 10);
    this.products = [{ name: '', quantity: 1, mrp: 0 }];
    this.currentId = null;
    this.showToast('New invoice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSaved(): void {
    this.showSaved = !this.showSaved;
  }

  // ---- Output ----
  print(): void {
    window.print();
  }

  private fileName(): string {
    const safe = (this.invoiceNumber || 'invoice').replace(/[^a-z0-9\-_]+/gi, '_');
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
    const doc = await this.buildPdf();
    doc.save(this.fileName());
    this.showToast('PDF downloaded');
  }

  async sharePdf(): Promise<void> {
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
      this.showToast('Sharing not supported here — PDF downloaded instead');
    }
  }

  // ---- Helpers ----
  private nextInvoiceNumber(): string {
    return 'INV-' + new Date().getFullYear() + '-001';
  }

  private newId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = ''), 2500);
  }
}
