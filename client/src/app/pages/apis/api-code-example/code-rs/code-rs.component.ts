import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { Api } from '@shared/models/api.model';

@Component({
  standalone: true,
  selector: 'app-code-rs',
  templateUrl: './code.rs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  preserveWhitespaces: true,
  imports: [LowerCasePipe]
})
export class CodeRsComponent {
  @Input() api!: Api;
  @Input() gatewayUrl!: string;
  @ViewChild('codeEl') codeEl!: ElementRef<HTMLElement>;

  public getCode(): string {
    return this.codeEl.nativeElement.innerText;
  }
}
