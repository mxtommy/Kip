import { Component } from '@angular/core';

import { SignalKService } from './signalk.service';

@Component({
  selector: 'app-root',
  providers: [SignalKService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private signalKService: SignalKService) { }

  speed = this.signalKService.connectSignalK('aaa');
}
