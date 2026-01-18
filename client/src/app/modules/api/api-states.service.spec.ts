import { TestBed } from '@angular/core/testing';

import { ApiStatesService } from './api-states.service';

describe('ApiStatesService', () => {
  let service: ApiStatesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = new ApiStatesService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
