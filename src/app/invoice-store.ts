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

  newId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  }
}
