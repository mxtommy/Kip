import { Injectable } from '@angular/core';

import { SignalKService } from './signalk.service';

@Injectable()
export class SignalKFullService {

  constructor(private SignalKService: SignalKService,) { }


  processFullUpdate(data) {

    //set self urn
    this.SignalKService.setSelf(data.self)

    // set Sources
    //this.SignalKService.setDataFull(data);

    // so we will walk the array recusively
    this.findKeys(data);
  }

  findKeys(data, currentPath: string[] = []) {
    let path = currentPath.join('.');


    
    if ( (typeof(data) == 'string') || (typeof(data) == 'number')) {  // is it a simple value?
      let timestamp = Date.now();
      let source = 'noSource'
      this.SignalKService.updatePathData(path, source, timestamp, data);
      this.SignalKService.setDefaultSource(path, source);
      return;
    }     
    else if ('timestamp' in data) { // is it a timestamped value?

      // try and get source
      let source: string;
      if (typeof(data['$source']) == 'string') {
        source = data['$source'];
      } else if (typeof(data['source']) == 'object') {
        source = data['source']['label'];
      } else {
        source = 'noSource';
      }
      
      let timestamp = Date.parse(data.timestamp);

      // is it a normal value, or a compound value?
      if ('value' in data) {
        //simple
        this.SignalKService.updatePathData(path, source, timestamp, data.value);
        this.SignalKService.setDefaultSource(path, source);      
        // try and get metadata.
        if (typeof(data['meta']) == 'object') {
          this.SignalKService.setMeta(path, data['meta']);
        }
      } else { 
        // it's likely a compound value

        // get all objects in data
        let keys = Object.keys(data);
        let keysValid = [];
        for (let i = 0; i < keys.length; i++) { // get the ones aside from these
          if (keys[i] == '$source') { continue; }
          if (keys[i] == 'source') { continue; }
          if (keys[i] == 'timestamp') { continue; }
          if (keys[i] == 'pgn') { continue; }
          if (keys[i] == 'meta') { continue; }
          keysValid.push(keys[i]);
        } 
        for (let i = 0; i < keysValid.length; i++) { //now we add them
          console.log(keysValid[i]);
          this.SignalKService.updatePathData(path + '.' + keysValid[i], source, timestamp, data[keysValid[i]]);
          this.SignalKService.setDefaultSource(path + '.' + keysValid[i], source);      
          // try and get metadata.
          if (typeof(data['meta']) == 'object') {
            this.SignalKService.setMeta(path + '.' + keysValid[i], data['meta']);
          }          
        }
      }


      this.SignalKService.setDefaultSource(path, source);      

      return;
    } 
    
    // it's not a value, dig deaper
    else {
      // process children
      let keys = Object.keys(data);
      let len = keys.length;
      for (let i = 0; i < len; i += 1) {
        let newPath = currentPath.slice();
        newPath.push(keys[i])
        this.findKeys(data[keys[i]], newPath);
      }
    }
  }
 

}
