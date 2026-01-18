import { Component, Inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { API_MESSAGE_SERVICE_IMPL, IApiMessageService } from './modules/api/api-message/i-api-message.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('client');

  constructor(
    @Inject(API_MESSAGE_SERVICE_IMPL) _apiMessageService: IApiMessageService
  ) {}
}
