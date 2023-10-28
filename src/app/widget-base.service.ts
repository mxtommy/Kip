import { Injectable } from '@angular/core';
import { AppSettingsService } from './app-settings.service';
import { SignalKService } from './signalk.service';
import { UnitsService } from './units.service';

@Injectable({
  providedIn: 'root'
})
export class WidgetBaseService {
  constructor(
     public signalKService: SignalKService,
     public unitsService: UnitsService,
     public appSettingsService: AppSettingsService
  ) {
  }
}
