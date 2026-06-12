import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbBadgeModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { RealtimeService } from '../../../services/realtime.service';
import { RequestLogManagerService } from '../../../managers/request-log-manager/request-log-manager.service';
import { RealtimeTopic } from '@shared/types/realtime-topic';
import { RequestLog } from '@shared/models/request-log.model';

@Component({
  standalone: true,
  selector: 'app-request-errors',
  templateUrl: './request-errors.component.html',
  styleUrls: ['./request-errors.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NbCardModule, NbButtonModule, NbBadgeModule, TranslateModule]
})
export class RequestErrorsComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('listContainer') private _listContainer!: ElementRef;

  public entries = signal<RequestLog[]>([]);
  public autoScroll = signal(true);

  private readonly _MAX_ENTRIES = 500;
  private _unsubscribe: (() => void) | null = null;
  private _shouldScroll = false;
  private _knownIds = new Set<string>();

  public constructor(
    private readonly _realtimeService: RealtimeService,
    private readonly _requestLogManager: RequestLogManagerService
  ) {}

  public ngOnInit(): void {
    this._loadInitial();
    this._realtimeService.connect();
    this._unsubscribe = this._realtimeService.on(RealtimeTopic.RequestError, () => {
      this._fetchLatest();
    });
  }

  public ngAfterViewChecked(): void {
    if (this._shouldScroll && this._listContainer) {
      const el = this._listContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
      this._shouldScroll = false;
    }
  }

  public ngOnDestroy(): void {
    this._realtimeService.disconnect();
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  public clearEntries(): void {
    this.entries.set([]);
    this._knownIds.clear();
  }

  public toggleAutoScroll(): void {
    this.autoScroll.update(v => !v);
  }

  public formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  public getStatusClass(statusCode: number): string {
    if (statusCode >= 500) return 'status-5xx';
    if (statusCode >= 400) return 'status-4xx';
    return 'status-other';
  }

  private _loadInitial(): void {
    this._requestLogManager.getAll(100).subscribe(entries => {
      entries.forEach(e => this._knownIds.add(e.id));
      this.entries.set(entries);
    });
  }

  private _fetchLatest(): void {
    this._requestLogManager.getAll(50).subscribe(latest => {
      const fresh = latest.filter(e => !this._knownIds.has(e.id));
      if (fresh.length === 0) return;

      fresh.forEach(e => this._knownIds.add(e.id));
      this.entries.update(current => {
        const merged = [...fresh, ...current];
        if (merged.length > this._MAX_ENTRIES) {
          return merged.slice(0, this._MAX_ENTRIES);
        }
        return merged;
      });

      if (this.autoScroll()) {
        this._shouldScroll = true;
      }
    });
  }
}
