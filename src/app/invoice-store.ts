import { Injectable, signal } from '@angular/core';
import { InvoiceData, SavedInvoice } from './invoice.model';

const LIST_KEY = 'invoice-maker.invoices';
const OLD_KEY = 'invoice-maker.invoice';

/**
 * Single source of truth for saved invoices, backed by localStorage.
 * Exposed as a signal so every route/component stays in sync.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceStore {
  /** Reactive list of saved invoices (most recent first). */
  readonly invoices = signal<SavedInvoice[]>([]);

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(LIST_KEY);
      let list: SavedInvoice[] = [];
      if (raw) {
        const parsed = JSON.parse(raw) as SavedInvoice[];
        if (Array.isArray(parsed)) list = parsed;
      }
      // One-time migration from the old single-invoice storage.
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const data = JSON.parse(old) as InvoiceData;
        list.unshift({ ...data, id: this.newId(), savedAt: Date.now() });
        localStorage.removeItem(OLD_KEY);
        this.persist(list);
      }
      this.invoices.set(list);
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persist(list: SavedInvoice[]): boolean {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  getById(id: string): SavedInvoice | undefined {
    return this.invoices().find((i) => i.id === id);
  }

  /**
   * Create or update a saved invoice.
   * When `id` matches an existing record it is updated in place,
   * otherwise a new record is created. Returns the resulting record's id,
   * whether it was an update, and whether persistence succeeded.
   */
  saveSnapshot(
    data: InvoiceData,
    id: string | null
  ): { id: string; updated: boolean; ok: boolean } {
    const list = [...this.invoices()];
    if (id) {
      const idx = list.findIndex((i) => i.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...data, savedAt: Date.now() };
        this.invoices.set(list);
        return { id, updated: true, ok: this.persist(list) };
      }
    }
    const newId = this.newId();
    list.unshift({ ...data, id: newId, savedAt: Date.now() });
    this.invoices.set(list);
    return { id: newId, updated: false, ok: this.persist(list) };
  }

  remove(id: string): boolean {
    const list = this.invoices().filter((i) => i.id !== id);
    this.invoices.set(list);
    return this.persist(list);
  }

  // ---- Backup / transfer ----
  /** Serialise all invoices into a portable JSON backup string. */
  exportData(): string {
    return JSON.stringify(
      {
        app: 'invoice-maker',
        version: 1,
        exportedAt: Date.now(),
        invoices: this.invoices()
      },
      null,
      2
    );
  }

  /**
   * Merge invoices from a backup string into the store.
   * Accepts either a raw array or the wrapped `{ invoices: [...] }` format.
   * Matches on id: a newer (later savedAt) copy replaces an older one;
   * unseen invoices are added. Throws if the file isn't recognisable.
   */
  importData(raw: string): { added: number; updated: number; total: number } {
    const parsed = JSON.parse(raw);
    const incoming: unknown = Array.isArray(parsed) ? parsed : parsed?.invoices;
    if (!Array.isArray(incoming)) {
      throw new Error('Unrecognised backup file');
    }

    const byId = new Map(this.invoices().map((i) => [i.id, i]));
    let added = 0;
    let updated = 0;

    for (const item of incoming) {
      const inv = this.normalize(item);
      if (!inv) continue;
      const existing = byId.get(inv.id);
      if (!existing) {
        byId.set(inv.id, inv);
        added++;
      } else if ((inv.savedAt || 0) > (existing.savedAt || 0)) {
        byId.set(inv.id, inv);
        updated++;
      }
    }

    const list = [...byId.values()].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    this.invoices.set(list);
    this.persist(list);
    return { added, updated, total: list.length };
  }

  /** Coerce an untrusted object into a valid SavedInvoice, or null if unusable. */
  private normalize(raw: any): SavedInvoice | null {
    if (!raw || typeof raw !== 'object') return null;
    const products = Array.isArray(raw.products)
      ? raw.products.map((p: any) => ({
          name: String(p?.name ?? ''),
          quantity: Number(p?.quantity) || 0,
          mrp: Number(p?.mrp) || 0
        }))
      : [];
    return {
      businessName: String(raw.businessName ?? ''),
      ownerName: String(raw.ownerName ?? ''),
      businessPhone: String(raw.businessPhone ?? ''),
      customerName: String(raw.customerName ?? ''),
      customerPhone: String(raw.customerPhone ?? ''),
      invoiceNumber: String(raw.invoiceNumber ?? ''),
      invoiceDate: String(raw.invoiceDate ?? ''),
      products,
      id: typeof raw.id === 'string' && raw.id ? raw.id : this.newId(),
      savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now()
    };
  }

  newId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  }
}
