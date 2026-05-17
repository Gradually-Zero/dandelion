import { Component, input } from '@angular/core';
import { LucideCopy } from '@lucide/angular';

@Component({
  selector: 'app-window-restore-icon',
  imports: [LucideCopy],
  templateUrl: './window-restore-icon.html',
})
export class WindowRestoreIcon {
  readonly size = input<number | string>(16);
  readonly color = input<string>();
  readonly strokeWidth = input<number | string>();
  readonly absoluteStrokeWidth = input<boolean>();
  readonly title = input<string>();
}
