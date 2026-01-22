import { Injectable } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { ConfigApiService } from './config-api.service';
import { ConfigStatesService } from './config-states.service';
import { ConfigResponseDto } from '@shared/dtos/config-response.dto';
import { UpdateConfigDto } from '@shared/dtos/update-config.dto';

@Injectable({
  providedIn: 'root'
})
export class ConfigManagerService {
  constructor(
    private readonly _configApiService: ConfigApiService,
    private readonly _configStatesService: ConfigStatesService
  ) {}

  public loadConfig(): Observable<ConfigResponseDto> {
    return this._configApiService.getConfig().pipe(
      map((response) => response.body!),
      tap((config) => this._configStatesService.config.set(config))
    );
  }

  public updateConfig(dto: UpdateConfigDto): Observable<ConfigResponseDto> {
    return this._configApiService.updateConfig(dto).pipe(
      map((response) => response.body!),
      tap((config) => this._configStatesService.config.set(config))
    );
  }
}
