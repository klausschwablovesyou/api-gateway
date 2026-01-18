import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbProgressBarModule } from '@nebular/theme';

@Component({
  standalone: true,
  selector: 'app-memory-stat',
  templateUrl: './memory-stat.component.html',
  styleUrls: ['./memory-stat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbIconModule,
    NbProgressBarModule
  ]
})
export class MemoryStatComponent {
  @Input() icon: string = 'hard-drive-outline';
  @Input() label: string = '';
  @Input() value: string = '';
  @Input() percentage: number = 0;
  @Input() status: string = 'primary';
  @Input() details: string[] = [];
}
