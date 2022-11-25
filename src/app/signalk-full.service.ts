import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Subject, Observable, lastValueFrom } from 'rxjs';
import { ISignalKFullDocument } from './signalk-interfaces';
import { IDefaultSource, IMeta, IPathValueData } from "./app-interfaces";
import { IEndpointStatus, SignalKConnectionService } from "./signalk-connection.service";
import { satisfies } from 'compare-versions';


export interface IFullDocumentStatus {
  operation: number;
  message: string;
}

@Injectable()
export class SignalKFullService {

  private sKSupportedSchemaVersion: string = "~0.1.0";

  // Signal K full document data path Observable
  private sKFullDocPath$ = new Subject<IPathValueData>();
  // Signal K full document default source Observable
  private sKFullDocDefaultSource$ = new Subject<IDefaultSource>();
  // Signal K full document metadata Observable
  private sKFullDocMeta$ = new Subject<IMeta>();
  // Signal K full document Self value Observable
  private sKFullDocSelf$ = new Subject<string>();

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
    lastValueFrom(this.http.get<ISignalKFullDocument>(this.endpointHTTP, {observe: 'response'}))
    .then( response => {
      this.fullDocEndpoint.operation = 2;
      this.fullDocEndpoint.message = response.status.toString();
      this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
      console.log("[Full Document Service] Document retreived");
      this.processFullDocument(response.body);
    })
    .catch((err: HttpErrorResponse) => {
      this.fullDocEndpoint.operation = 3;
      this.fullDocEndpoint.message = err.message;
      this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
      console.error('[Full Document Service] Endpoint error retreiving document:', err.message);
    });
  }

  private processFullDocument(document: ISignalKFullDocument): void {
    // Check Document version (sk schema version) for compatibility
    if (!satisfies(document.version, this.sKSupportedSchemaVersion)) {
      console.error("Signal K schema version not supported by Kip. Contact Kip team");
      return;
    }

    // Set self urn so we can find our own vessel data in the document vessels subkey
    this.sKFullDocSelf$.next(document.self);

    // Walk the document array recusively
    this.findKeys(document);
  }

  private findKeys(document, currentPath: string[] = []): void {
    let path = currentPath.join('.');

    if (document === null) { //TODO: notifications don't have timestamp... We need to get notifications into local datasource
      return;
    }

    if (path == 'sources') { return; } // ignore the sources tree

    // check Value type
    if ( (typeof(document) == 'string') || (typeof(document) == 'number') || (typeof(document) == 'boolean')) {  // is it a simple value?
      let timestamp = Date.now();
      let source = 'noSource'

      let dataPath: IPathValueData = {
        path: path,
        source: source,
        timestamp: timestamp,
        value: document,
      };
      this.sKFullDocPath$.next(dataPath);

      let defaultSource: IDefaultSource = {
        path: path,
        source: source,
      }
      this.sKFullDocDefaultSource$.next(defaultSource);
      return;
    }
    else if ('timestamp' in document) { // is it a timestamped value?

      // try and get source
      let source: string;
      if (typeof(document['$source']) == 'string') {
        source = document['$source'];
      } else if (typeof(document['source']) == 'object') {
        source = document['source']['label'];
      } else {
        source = 'noSource';
      }

      let timestamp = Date.parse(document.timestamp);


      // is it a normal value, or a compound value?
      if ('value' in document) {
        if (typeof(document['value']) == 'object' && (document['value'] !== null)) {
          // compound
          Object.keys(document['value']).forEach(key => {
            let compoundPath = path+"." + key;

            let dataPath: IPathValueData = {
              path: compoundPath,
              source: source,
              timestamp: timestamp,
              value: document.value[key],
            };
            this.sKFullDocPath$.next(dataPath);

            let defaultSource: IDefaultSource = {
              path: compoundPath,
              source: source,
            };
            this.sKFullDocDefaultSource$.next(defaultSource);

            // Get metadata if available
            if (typeof(document['meta']) == 'object') {
              this.processMeta(document, compoundPath, key);
            }
          });
        } else {
          //simple
          let dataPath: IPathValueData = {
            path: path,
            source: source,
            timestamp: timestamp,
            value: document.value,
          };
          this.sKFullDocPath$.next(dataPath);

          let defaultSource: IDefaultSource = {
            path: path,
            source: source,
          };
          this.sKFullDocDefaultSource$.next(defaultSource);

          // try and get metadata.
          this.processMeta(document, path);
        }
      }

      return;
    }

    // it's not a value, dig deaper
    else {
      // process children
      let keys = Object.keys(document);
      let len = keys.length;
      for (let i = 0; i < len; i += 1) {
        let newPath = currentPath.slice();
        newPath.push(keys[i])
        this.findKeys(document[keys[i]], newPath);
      }
    }
  }

  private processMeta(document, dataPath: string, key?: string) {
    if (Object.keys(document.meta).length === 0) {
      return;
    } else {
      let meta: IMeta;
      //does meta have one with properties for each one?
      if (typeof(document.meta['properties']) == 'object' && typeof(document.meta.properties[key]) == 'object') {
        meta = {
          path: dataPath,
          meta: document.meta.properties[key],
        };

      } else {
        meta = {
          path: dataPath,
          meta: document['meta'],
        };

      }

      this.sKFullDocMeta$.next(meta);
    }
  }

  // FullDocument Connections Status observable
  public getFullDocumentStatusAsO(): Observable<IFullDocumentStatus> {
    return this.fullDocumentEndpoint$.asObservable();
  }

  public subscribeFullDocumentDataPathsUpdates(): Observable<IPathValueData> {
    return this.sKFullDocPath$.asObservable();
  }

  public subscribeDefaultSourceUpdates(): Observable<IDefaultSource> {
    return this.sKFullDocDefaultSource$.asObservable();
  }

  public subscribeMetaUpdates(): Observable<IMeta> {
    return this.sKFullDocMeta$.asObservable();
  }

  public subscribeSelfUpdates(): Observable<string> {
    return this.sKFullDocSelf$.asObservable();
  }

}
