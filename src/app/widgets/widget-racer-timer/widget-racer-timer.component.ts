import { Component, OnInit, OnDestroy, viewChild, inject, effect } from '@angular/core';

import { SignalkRequestsService, skRequest } from '../../core/services/signalk-requests.service';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgIf } from '@angular/common';
import {FormsModule} from '@angular/forms';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'widget-racer-timer',
    templateUrl: './widget-racer-timer.component.html',
    styleUrls: ['./widget-racer-timer.component.scss'],
    standalone: true,
  imports: [WidgetHostComponent, MatButton, NgIf, FormsModule]
})

export class WidgetRacerTimerComponent extends BaseWidgetComponent implements OnInit, OnDestroy {

  signalkRequestsService = inject(SignalkRequestsService);

  readonly startTimerBtn = viewChild<MatButton>('startTimerBtn');

  showTopTTS = true;
  showBottomDTS = true;
  timeToStart = '0:05:00';
  distanceToLine = '-';
  startTime = 'HH:MM:SS';

  constructor() {
    console.log(`WidgetRacerTimerComponent constructor`);
    super();
    this.defaultConfig = {
      displayName: 'N2k Autopilot',
      filterSelfPaths: true,
      paths: {
        'timeToStart': {
          description: 'Period in seconds to the Start time',
          path: 'self.navigation.racing.timeToStart',
          source: 'default',
          pathType: 'number',
          convertUnitTo: 's',
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 's',
          sampleTime: 500
        },
      }
    };
  }

  ngOnInit(): void {
    console.log('WidgetRacerTimerComponent ngOnInit');
    this.validateConfig();
  }

  protected startWidget(): void {
    console.log('WidgetRacerTimerComponent startWidget');
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    // this.unsubscribeSKRequest();
    console.log('WidgetRacerTimerComponent ngOnDestroy');
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    console.log('WidgetRacerTimerComponent updateConfig', JSON.stringify(config));
    this.widgetProperties.config = config;
  }

  adjustLineEnd(end: string, delta: number, rotate: number) {
  }

  toggleTopPane() {
    this.showTopTTS = !this.showTopTTS;
    console.log('WidgetRacerTimerComponent toggleTopPane');
  }

  toggleBottomPane() {
    this.showBottomDTS = !this.showBottomDTS;
    console.log('WidgetRacerTimerComponent toggleBottomPane');
  }

  setLineEnd(end: string) {
  }

  adjustStartTime(deltaSeconds: number) {
  }

  sendTimerCommand(command: string) {

  }

  setStartTimeAt(startTime: string) {

  }
}
