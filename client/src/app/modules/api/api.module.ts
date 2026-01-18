import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiMessageComponent } from './api-message/api-message.component';
import { TranslateModule } from "@ngx-translate/core";
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { ApiMessageService } from "./api-message/api-message.service";
import { ApiRequestDecoratorService } from "./api-request-decorator/api-request-decorator.service";
import { ApiProgressIndicatorComponent } from './api-progress-indicator/api-progress-indicator.component';
import { ApiProgressIndicatorService } from "./api-progress-indicator/api-progress-indicator.service";
@NgModule({
  declarations: [
    ApiMessageComponent,
    ApiProgressIndicatorComponent
  ],
  imports: [
    CommonModule,
    TranslateModule,
    NbCardModule,
    NbSpinnerModule
  ],
  exports: [
    ApiMessageComponent,
    ApiProgressIndicatorComponent
  ],
  providers: [
    ApiMessageService,
    ApiRequestDecoratorService,
    ApiProgressIndicatorService
  ]
})
export class ApiModule { }
