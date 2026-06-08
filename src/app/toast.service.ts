import { Injectable, signal } from '@angular/core';

/** App-wide transient toast messages, shown by the root shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string): void {
    this.message.set(message);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(''), 2500);
  }
}
