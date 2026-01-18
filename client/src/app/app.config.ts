import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, isDevMode, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { JwtInterceptor } from './interceptors/jwt.interceptor';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { NbToastrModule, NbThemeModule, NbSidebarModule, NbMenuModule, NbDialogModule } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { API_DEFAULT_MESSAGE_TIMEOUT } from '@app/modules/api/types/api-message';
import { API_PROGRESS_INDICATOR_SERVICE_IMPL, API_PROGRESS_INDICATOR_TIMEOUT } from '@app/modules/api/api-progress-indicator/i-api-progress-indicator.service';
import { API_MESSAGE_SERVICE_IMPL } from '@app/modules/api/api-message/i-api-message.service';
import { ApiMessageService } from '@app/modules/api/api-message/api-message.service';
import { ApiProgressIndicatorService } from '@app/modules/api/api-progress-indicator/api-progress-indicator.service';
import { ApiStatesService } from '@app/modules/api/api-states.service';
import { API_REQUEST_DECORATOR_SERVICE_IMPL, API_RESPONSE_MESSAGE_EXCEPTIONS } from '@app/modules/api/api-request-decorator/i-api-request-decorator.service';
import { ApiRequestDecoratorService } from '@app/modules/api/api-request-decorator/api-request-decorator.service';
import { API_CLIENT_SERVICE_IMPL } from '@app/modules/api/api-client/i-api-client.service';
import { ApiClientService } from '@app/modules/api/api-client/api-client.service';
import { apiMessageExceptions } from '@app/config/api-message-exceptions';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json'
      }),
      fallbackLang: 'en',
      lang: 'en'
    }),
    importProvidersFrom(
      NbThemeModule.forRoot({ name: 'cosmic' }),
      NbEvaIconsModule,
      NbSidebarModule.forRoot(),
      NbMenuModule.forRoot(),
      NbToastrModule.forRoot(),
      NbDialogModule.forRoot(),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    {
      provide: API_DEFAULT_MESSAGE_TIMEOUT,
      useValue: 2000
    },
    {
      provide: API_PROGRESS_INDICATOR_TIMEOUT,
      useValue: 1000
    },
    {
      provide: API_MESSAGE_SERVICE_IMPL,
      useClass: ApiMessageService
    },
    {
      provide: API_PROGRESS_INDICATOR_SERVICE_IMPL,
      useClass: ApiProgressIndicatorService,
      deps: [
        API_PROGRESS_INDICATOR_TIMEOUT,
        ApiStatesService
      ]
    },
    {
      provide: API_REQUEST_DECORATOR_SERVICE_IMPL,
      useClass: ApiRequestDecoratorService,
      deps: [
        API_MESSAGE_SERVICE_IMPL,
        API_PROGRESS_INDICATOR_SERVICE_IMPL,
        API_RESPONSE_MESSAGE_EXCEPTIONS,
        ApiStatesService,
        Router
      ]
    },
    {
      provide: API_CLIENT_SERVICE_IMPL,
      useClass: ApiClientService
    },
    {
      provide: API_RESPONSE_MESSAGE_EXCEPTIONS,
      useValue: apiMessageExceptions
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true
    }
  ]
};
