import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the invoice heading', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Invoice Maker');
  });

  it('should compute line and grand totals', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.products = [
      { name: 'A', quantity: 2, mrp: 50 },
      { name: 'B', quantity: 3, mrp: 10 },
    ];
    expect(app.lineTotal(app.products[0])).toBe(100);
    expect(app.totalQuantity).toBe(5);
    expect(app.grandTotal).toBe(130);
  });
});
