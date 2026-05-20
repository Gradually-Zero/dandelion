import { LucideX } from '@lucide/angular';
import { InputTextModule } from 'primeng/inputtext';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-clearable-input-text',
  imports: [InputTextModule, LucideX],
  templateUrl: './clearable-input-text.html',
})
export class ClearableInputText {
  @Input() value: string | null = null;
  @Input() disabled: boolean | null = null;
  @Input() fluid: boolean | null = null;
  @Input() type = 'text';

  @Output() valueChange = new EventEmitter<string | null>();
  @Output() clear = new EventEmitter<MouseEvent>();

  @ViewChild('inputRef') private inputRef?: ElementRef<HTMLInputElement>;

  protected get hasValue() {
    return this.value !== null && this.value !== '';
  }

  protected get canClear() {
    return this.hasValue && !this.disabled;
  }

  protected onInput(event: Event) {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected onClear(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.valueChange.emit(null);
    this.clear.emit(event);
    requestAnimationFrame(() => this.inputRef?.nativeElement.focus());
  }
}
