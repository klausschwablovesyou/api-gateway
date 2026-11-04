import { ElementRef } from '@angular/core';
import { of } from 'rxjs';
import { RequestErrorsComponent } from './request-errors.component';
import { RealtimeService } from '../../../services/realtime.service';
import { RequestLogManagerService } from '../../../managers/request-log-manager/request-log-manager.service';
import { RequestLog } from '@shared/models/request-log.model';
import { RealtimeTopic } from '@shared/types/realtime-topic';

describe('RequestErrorsComponent', () => {
  let realtime: jasmine.SpyObj<RealtimeService>;
  let manager: jasmine.SpyObj<RequestLogManagerService>;
  let unsubscribe: jasmine.Spy;
  let component: RequestErrorsComponent;

  const log = (id: string | number) => ({ id: String(id), statusCode: 500 }) as RequestLog;

  /** Simulates the realtime notification, after which the component fetches the given rows. */
  function notify(latest: RequestLog[]): void {
    manager.getAll.and.returnValue(of(latest));
    realtime.on.calls.mostRecent().args[1](null);
  }

  const ids = () => component.entries().map(entry => entry.id);

  beforeEach(() => {
    unsubscribe = jasmine.createSpy('unsubscribe');
    realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['connect', 'disconnect', 'on']);
    realtime.on.and.returnValue(unsubscribe);
    manager = jasmine.createSpyObj<RequestLogManagerService>('RequestLogManagerService', ['getAll']);
    manager.getAll.and.returnValue(of([log(2), log(1)]));
    component = new RequestErrorsComponent(realtime, manager);
  });

  describe('init and destroy', () => {
    it('should load the 100 latest entries', () => {
      component.ngOnInit();

      expect(manager.getAll).toHaveBeenCalledOnceWith(100);
      expect(ids()).toEqual(['2', '1']);
    });

    it('should connect and listen for request errors', () => {
      component.ngOnInit();

      expect(realtime.connect).toHaveBeenCalledTimes(1);
      expect(realtime.on).toHaveBeenCalledOnceWith(RealtimeTopic.RequestError, jasmine.any(Function));
    });

    it('should disconnect and stop listening on destroy', () => {
      component.ngOnInit();

      component.ngOnDestroy();

      expect(realtime.disconnect).toHaveBeenCalledTimes(1);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('realtime updates', () => {
    beforeEach(() => component.ngOnInit());

    it('should fetch the 50 latest entries when notified', () => {
      notify([]);

      expect(manager.getAll).toHaveBeenCalledWith(50);
    });

    it('should put only unknown entries first', () => {
      notify([log(3), log(2), log(1)]);

      expect(ids()).toEqual(['3', '2', '1']);
    });

    it('should not touch the list when nothing is new', () => {
      const before = component.entries();

      notify([log(2), log(1)]);

      expect(component.entries()).toBe(before);
    });

    it('should keep only the 500 newest entries', () => {
      notify(Array.from({ length: 498 }, (_, i) => log(`old-${i}`)));
      expect(component.entries().length).toBe(500);

      notify([log('newest')]);

      expect(component.entries().length).toBe(500);
      expect(ids()[0]).toBe('newest');
      expect(ids()).not.toContain('1');
    });
  });

  describe('clearEntries', () => {
    it('should empty the list and forget the known entries', () => {
      component.ngOnInit();

      component.clearEntries();
      expect(component.entries()).toEqual([]);

      notify([log(1)]);
      expect(ids()).toEqual(['1']);
    });
  });

  describe('auto scroll', () => {
    const container = { scrollTop: 0, scrollHeight: 400 };

    beforeEach(() => {
      container.scrollTop = 0;
      (component as unknown as { _listContainer: ElementRef })._listContainer = new ElementRef(container);
      component.ngOnInit();
    });

    it('should scroll once after new entries', () => {
      notify([log(3)]);
      component.ngAfterViewChecked();
      expect(container.scrollTop).toBe(400);

      container.scrollTop = 0;
      component.ngAfterViewChecked();
      expect(container.scrollTop).toBe(0);
    });

    it('should not scroll when nothing is new', () => {
      notify([log(1)]);
      component.ngAfterViewChecked();

      expect(container.scrollTop).toBe(0);
    });

    it('should not scroll when turned off', () => {
      component.toggleAutoScroll();
      expect(component.autoScroll()).toBeFalse();

      notify([log(3)]);
      component.ngAfterViewChecked();

      expect(container.scrollTop).toBe(0);
    });
  });

  describe('formatting', () => {
    const classes: Array<[number, string]> = [
      [500, 'status-5xx'],
      [503, 'status-5xx'],
      [499, 'status-4xx'],
      [400, 'status-4xx'],
      [399, 'status-other'],
      [200, 'status-other'],
    ];

    for (const [statusCode, expected] of classes) {
      it(`should use ${expected} for ${statusCode}`, () => {
        expect(component.getStatusClass(statusCode)).toBe(expected);
      });
    }

    it('should format the timestamp as local time', () => {
      expect(component.formatTimestamp(1000)).toBe(new Date(1000).toLocaleString());
    });
  });
});
