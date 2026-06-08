export interface Product {
  name: string;
  quantity: number;
  mrp: number;
}

export interface InvoiceData {
  businessName: string;
  ownerName: string;
  businessPhone: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  invoiceDate: string;
  products: Product[];
}

export interface SavedInvoice extends InvoiceData {
  id: string;
  savedAt: number;
}

/** Default business identity (pre-filled into every new invoice). */
export const DEFAULT_BUSINESS = {
  businessName: 'Noori',
  ownerName: 'Danish',
  businessPhone: '9762239565'
};

export function invoiceTotal(inv: InvoiceData): number {
  return (inv.products || []).reduce(
    (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.mrp) || 0),
    0
  );
}
