import { Injectable } from '@angular/core';
import { SignalKService } from './signalk.service';
import { SignalKConnectionService } from "./signalk-connection.service";
@Injectable()
export class SignalKFullService {

  constructor(
    private SignalKService: SignalKService,
    private signalKConnectionService: SignalKConnectionService,
  ) {
    this.signalKConnectionService.messageREST$.subscribe({
      next: msg => this.processFullUpdate(msg), // Called whenever there is a REST response message from the server.
      error: err => console.error("[REST Full Service] Message subscription error: " + JSON.stringify(err, ["code", "message", "type"])), // Called if at any point Subject has some kind of error.
      complete: () => console.log('[REST Full Service] Message subscription closed') // Called when Subject is closed (for whatever reason).
    });
  }

  private processFullUpdate(data): void {

    //set self urn
    this.SignalKService.setSelf(data.self)

    // so we will walk the array recusively
    this.findKeys(data);
  }

  private findKeys(data, currentPath: string[] = []): void {
    let path = currentPath.join('.');

    if (data === null) { //notifications don't have timestamp... hmmm TODO get notif into tree...
      return;
    }
    if (path == 'sources') { return; } // ignore the sources tree

    if ( (typeof(data) == 'string') || (typeof(data) == 'number') || (typeof(data) == 'boolean')) {  // is it a simple value?
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
        if (typeof(data['value']) == 'object' && (data['value'] !== null)) {
          // compound
          Object.keys(data['value']).forEach(key => {
            let compoundPath = path+"."+key;
            this.SignalKService.updatePathData(compoundPath, source, timestamp, data.value[key]);
            this.SignalKService.setDefaultSource(compoundPath, source);
            // try and get metadata.
            if (typeof(data['meta']) == 'object') {
              //does meta have one with properties for each one?
              if (typeof(data.meta['properties']) == 'object' && typeof(data.meta.properties[key]) == 'object') {
                this.SignalKService.setMeta(compoundPath, data.meta.properties[key]);
              } else {
                this.SignalKService.setMeta(compoundPath, data['meta']);
              }
            }
          });
        } else {
          //simple
          this.SignalKService.updatePathData(path, source, timestamp, data.value);
          this.SignalKService.setDefaultSource(path, source);
          // try and get metadata.
          if (typeof(data['meta']) == 'object') {
            this.SignalKService.setMeta(path, data['meta']);
          }
        }
      }

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
