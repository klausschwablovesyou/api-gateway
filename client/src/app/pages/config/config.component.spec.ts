import { of } from 'rxjs';
import { ConfigComponent } from './config.component';
import { ConfigManagerService } from '@app/managers/config-manager/config-manager.service';
import { ConfigStatesService } from '@app/managers/config-manager/config-states.service';

describe('ConfigComponent', () => {
  for (const enabled of [true, false]) {
    it(`should save enableRegistration=${enabled}`, () => {
      const manager = jasmine.createSpyObj<ConfigManagerService>('ConfigManagerService', ['updateConfig']);
      manager.updateConfig.and.returnValue(of({ enableRegistration: enabled }));

      new ConfigComponent(manager, new ConfigStatesService()).onEnableRegistrationChange(enabled);

      expect(manager.updateConfig).toHaveBeenCalledOnceWith({ enableRegistration: enabled });
    });
  }
});
