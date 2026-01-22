import { Injectable } from '@angular/core';
import { State } from 'ngx-states';
import { ConfigResponseDto } from '@shared/dtos/config-response.dto';

@Injectable({
  providedIn: 'root'
})
export class ConfigStatesService {
  public config: State<ConfigResponseDto> = new State<ConfigResponseDto>();
}
