import { Component, OnInit, Inject } from '@angular/core';
import { MdDialog, MdDialogRef, MD_DIALOG_DATA } from '@angular/material';


import { SignalKService, pathObject } from '../signalk.service';
import { DerivedService, IDerivation } from '../derived.service';

@Component({
  selector: 'app-settings-derived',
  templateUrl: './settings-derived.component.html',
  styleUrls: ['./settings-derived.component.css']
})
export class SettingsDerivedComponent implements OnInit {

  possibleDerivations = [];

  constructor(
    public dialog: MdDialog,
    private SignalKService: SignalKService,
    private DerivedService: DerivedService) { }

  ngOnInit() {
    this.possibleDerivations = this.DerivedService.getPossibleDerivations();
  }

  loadDerivations() {
    this.possibleDerivations = this.DerivedService.getPossibleDerivations();    
  }

  activateDerivation(derivationName: string) {
    let dialogRef = this.dialog.open(SettingsDerivedModalComponent, {
      width: '600px',
      data: derivationName
    });
    dialogRef.afterClosed().subscribe(result => { this.loadDerivations() });
  }

}



@Component({
  selector: 'app-settings-derived-modal',
  templateUrl: './settings-derived.modal.html',
  styleUrls: ['./settings-derived.component.css']
})
export class SettingsDerivedModalComponent implements OnInit {
  derivationName: string;
  possibleDerivations = [];
  requiredPaths = [];
  updateAny = true;
  
  constructor(
    private SignalKService: SignalKService,
    private DerivedService: DerivedService,
    public dialogRef: MdDialogRef<SettingsDerivedModalComponent>,
    @Inject(MD_DIALOG_DATA) public data: any
    ) { }

  ngOnInit() {
    this.derivationName = this.data;
    this.possibleDerivations = this.DerivedService.getPossibleDerivations();    
    let derivationIndex = this.possibleDerivations.findIndex(der => der.name == this.derivationName);
    if (derivationIndex < 0) { this.dialogRef.close(); } // not found, just stop there....

    // build path array with sources
    for (let x=0; x < this.possibleDerivations[derivationIndex].requiredPaths.length; x++) {
      //get sources for this path
      let path = this.possibleDerivations[derivationIndex].requiredPaths[x];
      let sources = ['default'];

      let pathObject = this.SignalKService.getPathObject(path);
      
      if (pathObject !== null) { 
        sources = sources.concat(Object.keys(pathObject.sources));
      }
      this.requiredPaths.push({path: path, availableSources: sources, selectedSource: 'default'});
    }
  }

  activateDerivation() {

    let newDerivation: IDerivation = {name: this.derivationName, updateAny: this.updateAny, paths: []};
    for (let x=0; x< this.requiredPaths.length; x++) {
      newDerivation.paths.push({path: this.requiredPaths[x].path,  source: this.requiredPaths[x].selectedSource});
    }
    this.DerivedService.addDerivation(newDerivation);
    this.dialogRef.close();
  }





}