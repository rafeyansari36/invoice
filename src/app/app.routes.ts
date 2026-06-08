import { Routes } from '@angular/router';
import { InvoiceEditor } from './invoice-editor/invoice-editor';
import { SavedInvoices } from './saved-invoices/saved-invoices';

export const routes: Routes = [
  { path: '', component: InvoiceEditor, title: 'Invoice Maker' },
  { path: 'edit/:id', component: InvoiceEditor, title: 'Edit invoice' },
  { path: 'saved', component: SavedInvoices, title: 'Saved invoices' },
  { path: '**', redirectTo: '' }
];
