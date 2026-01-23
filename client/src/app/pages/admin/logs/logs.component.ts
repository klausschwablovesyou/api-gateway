import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbSelectModule, NbToggleModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { RealtimeService } from '../../../services/realtime.service';
import { RealtimeTopic } from '@shared/types/realtime-topic';
import { LogEntry } from '@shared/types/log-entry';
import { LogLevel } from '@shared/types/log-level';

@Component({
  standalone: true,
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    NbCardModule,
    NbButtonModule,
    NbSelectModule,
    NbToggleModule,
    NbIconModule,
    TranslateModule
  ]
})
export class LogsComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logContainer') private logContainer!: ElementRef;

  public logs = signal<LogEntry[]>([]);
  public filterLevel = signal<LogLevel | 'ALL'>('ALL');
  public autoScroll = signal(true);

  public readonly logLevels: (LogLevel | 'ALL')[] = ['ALL', LogLevel.LOG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.DEBUG];
  public readonly LogLevel = LogLevel;

  private readonly MAX_LOGS = 500;
  private _unsubscribe: (() => void) | null = null;
  private _shouldScroll = false;

  public filteredLogs = computed(() => {
    const filter = this.filterLevel();
    const allLogs = this.logs();
    if (filter === 'ALL') {
      return allLogs;
    }
    return allLogs.filter(log => log.level === filter);
  });

  constructor(private _realtimeService: RealtimeService) {}

  public ngOnInit(): void {
    this._realtimeService.connect();
    this._unsubscribe = this._realtimeService.on(RealtimeTopic.ConsoleLog, (logEntry: LogEntry) => {
      this.logs.update(logs => {
        const newLogs = [...logs, logEntry];
        if (newLogs.length > this.MAX_LOGS) {
          return newLogs.slice(-this.MAX_LOGS);
        }
        return newLogs;
      });
      if (this.autoScroll()) {
        this._shouldScroll = true;
      }
    });
  }

  public ngAfterViewChecked(): void {
    if (this._shouldScroll && this.logContainer) {
      this.scrollToBottom();
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

  public clearLogs(): void {
    this.logs.set([]);
  }

  public setFilterLevel(level: LogLevel | 'ALL'): void {
    this.filterLevel.set(level);
  }

  public toggleAutoScroll(): void {
    this.autoScroll.update(value => !value);
  }

  public getLogLevelClass(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return 'log-error';
      case LogLevel.WARN:
        return 'log-warn';
      case LogLevel.INFO:
        return 'log-info';
      case LogLevel.DEBUG:
        return 'log-debug';
      default:
        return 'log-default';
    }
  }

  public formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  private scrollToBottom(): void {
    if (this.logContainer) {
      const element = this.logContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
}
