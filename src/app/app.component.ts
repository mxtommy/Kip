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

  unlockStatus: boolean = false; 

  unlockPage() {
    if (this.unlockStatus) {
      console.log("Locking");
      this.unlockStatus = false;
    } else {
      console.log("Unlocking");
      this.unlockStatus = true;
    }


  }


}
