import { MemoryComponent, MemoryUsageData } from './memory.component';
import { RealtimeService } from '../../../services/realtime.service';
import { RealtimeTopic } from '@shared/types/realtime-topic';

describe('MemoryComponent', () => {
  const DATA: MemoryUsageData = {
    backend: { heapUsed: 25, heapTotal: 100, rss: 200, external: 5 },
    telegram: { count: 1, estimated: 10 },
    realtime: { count: 2, estimated: 20 },
    database: { count: 3, estimated: 30 }
  };

  let realtime: jasmine.SpyObj<RealtimeService>;
  let unsubscribe: jasmine.Spy;
  let component: MemoryComponent;

  const receive = (data: MemoryUsageData) => realtime.on.calls.mostRecent().args[1](data);

  beforeEach(() => {
    unsubscribe = jasmine.createSpy('unsubscribe');
    realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    realtime.on.and.returnValue(unsubscribe);
    component = new MemoryComponent(realtime);
  });

  it('should start loading, with empty totals', () => {
    expect(component.isLoading()).toBeTrue();
    expect(component.memoryData()).toBeNull();
    expect(component.totalEstimated()).toBe(0);
    expect(component.heapPercentage()).toBe(0);
  });

  it('should listen for memory usage on init', () => {
    component.ngOnInit();

    expect(realtime.on).toHaveBeenCalledOnceWith(RealtimeTopic.MemoryUsage, jasmine.any(Function));
  });

  it('should store received data and stop loading', () => {
    component.ngOnInit();

    receive(DATA);

    expect(component.memoryData()).toBe(DATA);
    expect(component.isLoading()).toBeFalse();
  });

  it('should compute the totals from the received data', () => {
    component.ngOnInit();

    receive(DATA);

    expect(component.totalEstimated()).toBe(60);
    expect(component.heapPercentage()).toBe(25);
  });

  it('should report 0% for an empty heap', () => {
    component.ngOnInit();

    receive({ ...DATA, backend: { ...DATA.backend, heapTotal: 0 } });

    expect(component.heapPercentage()).toBe(0);
  });

  it('should stop listening on destroy, once', () => {
    component.ngOnInit();

    component.ngOnDestroy();
    component.ngOnDestroy();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  describe('formatBytes', () => {
    const cases: Array<[number, string]> = [
      [0, '0 B'],
      [500, '500 B'],
      [1024, '1 KB'],
      [1536, '1.5 KB'],
      [5 * 1024 * 1024, '5 MB'],
      [2.25 * 1024 * 1024 * 1024, '2.25 GB'],
    ];

    for (const [bytes, expected] of cases) {
      it(`should format ${bytes} as ${expected}`, () => {
        expect(component.formatBytes(bytes)).toBe(expected);
      });
    }
  });

  describe('getPercentage', () => {
    it('should round to a whole number', () => {
      expect(component.getPercentage(1, 3)).toBe(33);
    });

    it('should return 0 for a total of 0', () => {
      expect(component.getPercentage(5, 0)).toBe(0);
    });
  });

  describe('getStatus', () => {
    const cases: Array<[number, string]> = [
      [0, 'success'],
      [49, 'success'],
      [50, 'warning'],
      [74, 'warning'],
      [75, 'danger'],
      [100, 'danger'],
    ];

    for (const [percentage, expected] of cases) {
      it(`should be ${expected} at ${percentage}%`, () => {
        expect(component.getStatus(percentage)).toBe(expected);
      });
    }
  });
});
