import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ApiProgressIndicatorComponent } from './api-progress-indicator.component';
import { ApiStatesService } from '../api-states.service';
import { ChangeDetectorRef } from '@angular/core';
import { State } from "../../../types/state";
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from "primeng/dialog";
import { ProgressBarModule } from "primeng/progressbar";
import { MockPipe } from "ng-mocks";

describe('ApiProgressIndicatorComponent', () => {
  let component: ApiProgressIndicatorComponent;
  let fixture: ComponentFixture<ApiProgressIndicatorComponent>;
  let apiStatesService: ApiStatesService;
  let changeDetectorRef: ChangeDetectorRef;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ DialogModule, ProgressBarModule ],
      declarations: [ ApiProgressIndicatorComponent, MockPipe(TranslatePipe) ],
      providers: [
        { provide: ApiStatesService, useValue: {
            isProgressIndicatorVisible: new State(false),
            responseInProgressText: undefined
          }},
        { provide: ChangeDetectorRef, useValue: {
          markForCheck: jest.fn()
          } }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ApiProgressIndicatorComponent);
    component = fixture.componentInstance;
    apiStatesService = TestBed.inject(ApiStatesService);
    changeDetectorRef = TestBed.inject(ChangeDetectorRef);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set progressText and isProgressVisible based on apiStatesService', () => {
    expect(component.isProgressVisible).toBeFalsy();

    const testProgressText = 'In Progress...'

    apiStatesService.responseInProgressText = testProgressText;
    apiStatesService.isProgressIndicatorVisible.set(true);

    expect(component.progressText).toEqual(testProgressText);
    expect(component.isProgressVisible).toBeTruthy();
  });

  it('should call markForCheck on changeDetectorRef when isProgressVisible changes', () => {
    const markForCheckSpy = jest.spyOn(changeDetectorRef, 'markForCheck');

    apiStatesService.isProgressIndicatorVisible.set(true).subscribe(() => expect(markForCheckSpy).toHaveBeenCalled());
  });
});
