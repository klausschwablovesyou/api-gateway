import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { Api } from '@shared/models/api.model';

@Component({
  standalone: true,
  selector: 'app-code-py',
  templateUrl: './code.py.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  preserveWhitespaces: true,
  imports: [LowerCasePipe]
})
export class CodePyComponent {
  @Input() api!: Api;
  @Input() gatewayUrl!: string;
  @ViewChild('codeEl') codeEl!: ElementRef<HTMLElement>;

  public getCode(): string {
    return this.codeEl.nativeElement.innerText;
  }
}
