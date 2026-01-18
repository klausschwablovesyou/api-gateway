import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DetectionsManager } from '../../../managers/detections-manager/detections.manager';
import { RealtimeService } from '../../../services/realtime.service';
import { RealtimeTopic } from '@shared/types/realtime-topic';
import type { SolanaDetectionDto } from '@shared/dtos/solana-detection.dto';

@Component({
  standalone: true,
  selector: 'app-detections',
  templateUrl: './detections.component.html',
  styleUrls: ['./detections.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbCardModule,
    NbIconModule,
    NbSpinnerModule,
    TranslateModule
  ]
})
export class DetectionsComponent implements OnInit, OnDestroy {
  public isLoading = signal(false);
  public detections = signal<SolanaDetectionDto[]>([]);
  public expandedRows = signal<Set<number>>(new Set());

  private _unsubscribe: (() => void) | null = null;

  constructor(
    private _detectionsManager: DetectionsManager,
    private _realtimeService: RealtimeService
  ) {}

  public ngOnInit(): void {
    this._unsubscribe = this._realtimeService.on(RealtimeTopic.NewDetection, () => {
      this.loadDetections();
    });

    this.loadDetections();
  }

  public ngOnDestroy(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  private loadDetections(): void {
    this.isLoading.set(true);

    this._detectionsManager.getAll().subscribe({
      next: (detections) => {
        this.detections.set(detections);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('[Detections] Failed to load:', error);
        this.isLoading.set(false);
      }
    });
  }

  public toggleRow(id: number): void {
    const expanded = new Set(this.expandedRows());
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    this.expandedRows.set(expanded);
  }

  public isExpanded(id: number): boolean {
    return this.expandedRows().has(id);
  }

  public formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  public truncateText(text: string, maxLength: number = 100): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}
