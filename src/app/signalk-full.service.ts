import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Subject, Observable, lastValueFrom } from 'rxjs';
import { ISignalKDataPath } from "./signalk-interfaces";
import { IEndpointStatus, SignalKConnectionService } from "./signalk-connection.service";

export interface IFullDocumentStatus {
  operation: number;
  message: string;
}

export interface IDefaultSource {
  path: string;
  source: string;
}

export interface IMeta {
  path: string;
  meta: any;
}

@Injectable()
export class SignalKFullService {


  // SignalK data path full document Observable
  private signalKFullDocument$ = new Subject<ISignalKDataPath>();
  // SignalK default source Observable
  private signalKdefaultSource$ = new Subject<IDefaultSource>();
  // SignalK default source Observable
  private signalKMeta$ = new Subject<IMeta>();
  // SignalK default source Observable
  private signalKSelf$ = new Subject<string>();

  public fullDocEndpoint: IFullDocumentStatus = {
    operation: 0,
    message: "Not connected",
  }
  public fullDocumentEndpoint$: BehaviorSubject<IFullDocumentStatus> = new BehaviorSubject<IFullDocumentStatus>(this.fullDocEndpoint);
  private endpointHTTP: string = null;

  constructor(
    private http: HttpClient,
    private server: SignalKConnectionService,
  ) {

    this.fullDocEndpoint.message = "Connecting...";
    this.fullDocEndpoint.operation = 1;
    this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
    this.server.serverServiceEndpoint$.subscribe((endpointStatus: IEndpointStatus) => {
      if (endpointStatus.operation === 2 ) {
        this.endpointHTTP = endpointStatus.httpServiceUrl;
        this.getFullDocument();
      }
    });
  }

  private getFullDocument() {
    lastValueFrom(this.http.get(this.endpointHTTP, {observe: 'response'}))
    .then( response => {
      this.fullDocEndpoint.operation = 2;
      this.fullDocEndpoint.message = response.status.toString();
      this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
      console.log("[Full Document Service] Document retreived");
      this.processFullUpdate(response.body);
    })
    .catch((err: HttpErrorResponse) => {
      this.fullDocEndpoint.operation = 3;
      this.fullDocEndpoint.message = err.message;
      this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
      console.error('[Full Document Service] Endpoint error retreiving document:', err.message);
    });
  }

  private processFullUpdate(data): void {
    //set self urn
    this.signalKSelf$.next(data.self);
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

      let dataPath: ISignalKDataPath = {
        path: path,
        source: source,
        timestamp: timestamp,
        value: data,
      };
      this.signalKFullDocument$.next(dataPath);

      let defaultSource: IDefaultSource = {
        path: path,
        source: source,
      }
      this.signalKdefaultSource$.next(defaultSource);
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

            let dataPath: ISignalKDataPath = {
              path: compoundPath,
              source: source,
              timestamp: timestamp,
              value: data.value[key],
            };
            this.signalKFullDocument$.next(dataPath);

            let defaultSource: IDefaultSource = {
              path: compoundPath,
              source: source,
            };
            this.signalKdefaultSource$.next(defaultSource);

            // try and get metadata.
            if (typeof(data['meta']) == 'object') {
              //does meta have one with properties for each one?
              if (typeof(data.meta['properties']) == 'object' && typeof(data.meta.properties[key]) == 'object') {
                let meta: IMeta = {
                  path: compoundPath,
                  meta: data.meta.properties[key],
                };
                this.signalKMeta$.next(meta);
              } else {
                let meta: IMeta = {
                  path: compoundPath,
                  meta: data['meta'],
                };
                this.signalKMeta$.next(meta);
              }
            }
          });
        } else {
          //simple
          let dataPath: ISignalKDataPath = {
            path: path,
            source: source,
            timestamp: timestamp,
            value: data.value,
          };
          this.signalKFullDocument$.next(dataPath);

          let defaultSource: IDefaultSource = {
            path: path,
            source: source,
          };
          this.signalKdefaultSource$.next(defaultSource);

          // try and get metadata.
          if (typeof(data['meta']) == 'object') {
            let meta: IMeta = {
              path: path,
              meta: data['meta'],
            };
            this.signalKMeta$.next(meta);
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

  // FullDocument Connections Status observable
  public getFullDocumentStatusAsO(): Observable<IFullDocumentStatus> {
    return this.fullDocumentEndpoint$.asObservable();
  }

  public subscribeFullDocumentDataPathsUpdates(): Observable<ISignalKDataPath> {
    return this.signalKFullDocument$.asObservable();
  }

  public subscribeDefaultSourceUpdates(): Observable<IDefaultSource> {
    return this.signalKdefaultSource$.asObservable();
  }

  public subscribeMetaUpdates(): Observable<IMeta> {
    return this.signalKMeta$.asObservable();
  }

  public subscribeSelfUpdates(): Observable<string> {
    return this.signalKSelf$.asObservable();
  }

}
