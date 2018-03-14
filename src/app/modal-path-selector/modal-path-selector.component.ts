import { Component, Input, OnInit } from '@angular/core';
import { SignalKService, pathObject } from '../signalk.service';



@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.css']
})
export class ModalPathSelectorComponent implements OnInit {

  @Input('path') path: string;
  @Input('type') type: string; // number, boolean, string

  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableSources: Array<string>;

  constructor(private SignalKService: SignalKService) { }

  ngOnInit() {
    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType(this.type).sort();
    if (this.availablePaths.includes(this.path)) {
      //this.settingsDataUpdatePath(); //TODO: this wipes out existing config, not good when editing existing config...
    }    
  }

}
