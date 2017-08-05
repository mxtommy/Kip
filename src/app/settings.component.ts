import { Component } from '@angular/core';
import { SignalKService } from './signalk.service';


@Component({
  selector: 'app-root',
  providers: [SignalKService],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})

export class SettingsComponent {

  constructor(private signalKService: SignalKService) { }

  speed = this.signalKService.connectSignalK('aaa');
}
