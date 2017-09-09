import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs/Subscription';

import { SignalKService, pathObject } from '../signalk.service';


@Component({
  selector: 'app-widget-text-generic',
  templateUrl: './widget-text-generic.component.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericComponent implements OnInit, OnDestroy {

  @Input('nodeUUID') nodeUUID: string;

  modalRef;

  settingsForm = {
    signalKPath: ''
  }
  availablePaths;

  pathObject: pathObject;
  dataValue: any = null;
  dataTimestamp: number = Date.now();

  valueSub: Subscription = null;


  
  constructor(private modalService: NgbModal, private SignalKService: SignalKService) {
  }

  ngOnInit() {
    this.valueSub = this.SignalKService.subscribePath(this.nodeUUID, "vessels.self.navigation.speedOverGround").subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        this.pathObject = pathObject;


        this.dataValue = pathObject.sources[pathObject.defaultSource].value;
        this.dataTimestamp = pathObject.sources[pathObject.defaultSource].timestamp;
      }
    );
  }

  ngOnDestroy() {
    if (this.valueSub !== null) { // seems we can destroy even before we subbed? Oh well...
      this.valueSub.unsubscribe();
    }
  }

  ngAfterViewInit() {
  }

  openWidgetSettings(content) {
      //this.availablePaths = this.SignalKService.getNumberPaths(true);
      console.log(this.availablePaths);
      this.modalRef = this.modalService.open(content);
      this.modalRef.result.then((result) => {
      }, (reason) => {
      });
  }
  
  saveSettings() {
      this.modalRef.close();
  
  }

}
