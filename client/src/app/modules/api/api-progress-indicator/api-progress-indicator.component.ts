import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ApiStatesService } from "../api-states.service";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { skip } from "rxjs/operators";
import { isNullOrUndefined } from "@app/helpers/type.helper";

@UntilDestroy()
@Component({
  standalone: false,
  selector: 'lib-api-progress-indicator',
  templateUrl: './api-progress-indicator.component.html',
  styleUrls: ['./api-progress-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiProgressIndicatorComponent implements OnInit {
  public progressText = 'Common.In-progress';
  public isProgressVisible = false;

  constructor(private _states: ApiStatesService,
              private _changeRef: ChangeDetectorRef) {}

  ngOnInit(): void {
    this._states.isProgressIndicatorVisible.state
      .pipe(untilDestroyed(this))
      .pipe(skip(1))
      .subscribe(isVisible => {
        if (!isNullOrUndefined(this._states.responseInProgressText)) {
          this.progressText = this._states.responseInProgressText!;
        }

        this.isProgressVisible = isVisible;
        this._changeRef.detectChanges();
      });
  }
}
