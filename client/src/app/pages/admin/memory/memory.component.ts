import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { RealtimeService } from '../../../services/realtime.service';
import { RealtimeTopic } from '@shared/types/realtime-topic';
import { MemoryStatComponent } from './memory-stat/memory-stat.component';

export interface MemoryUsageData {
  backend: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  telegram: {
    count: number;
    estimated: number;
  };
  realtime: {
    count: number;
    estimated: number;
  };
  database: {
    count: number;
    estimated: number;
  };
}

@Component({
  standalone: true,
  selector: 'app-memory',
  templateUrl: './memory.component.html',
  styleUrls: ['./memory.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbCardModule,
    NbSpinnerModule,
    TranslateModule,
    MemoryStatComponent
  ]
})
export class MemoryComponent implements OnInit, OnDestroy {
  public memoryData = signal<MemoryUsageData | null>(null);
  public isLoading = signal(true);

  public totalEstimated = computed(() => {
    const data = this.memoryData();
    if (!data) return 0;
    return data.telegram.estimated + data.realtime.estimated + data.database.estimated;
  });

  public heapPercentage = computed(() => {
    const data = this.memoryData();
    if (!data || data.backend.heapTotal === 0) return 0;
    return Math.round((data.backend.heapUsed / data.backend.heapTotal) * 100);
  });

  private _unsubscribe: (() => void) | null = null;

  constructor(private _realtimeService: RealtimeService) {}

  public ngOnInit(): void {
    this._unsubscribe = this._realtimeService.on(RealtimeTopic.MemoryUsage, (data: MemoryUsageData) => {
      this.memoryData.set(data);
      this.isLoading.set(false);
    });
  }

  public ngOnDestroy(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public getPercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  public getStatus(percentage: number): string {
    if (percentage < 50) return 'success';
    if (percentage < 75) return 'warning';
    return 'danger';
  }
}
