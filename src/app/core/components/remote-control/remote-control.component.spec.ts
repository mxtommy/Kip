import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { RemoteControlComponent } from './remote-control.component';
import { DataService } from '../../services/data.service';

describe('RemoteControlComponent', () => {
  let component: RemoteControlComponent;
  let fixture: ComponentFixture<RemoteControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoteControlComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RemoteControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

class FakeDataService {
  treeSubject = new Subject<{ path: string; update: { data: { value: unknown; timestamp: Date | null }; state: string } }>();
  unsubCalls: { path: string; source: string }[] = [];

  subscribePathTree() {
    return this.treeSubject.asObservable();
  }

  subscribePath() {
    return new Subject<{ data: { value: unknown; timestamp: Date | null }; state: string }>().asObservable();
  }

  unsubscribePath(path: string, source: string): void {
    this.unsubCalls.push({ path, source });
  }
}

// A remote display is only picked up once its path payload carries a displayName,
// mirroring what the real self.displays.<id> root node looks like on the wire.
function pushDisplay(dataSvc: FakeDataService, displayId: string, displayName: string): void {
  dataSvc.treeSubject.next({
    path: `self.displays.${displayId}`,
    update: { data: { value: { displayName }, timestamp: null }, state: 'normal' }
  });
}

describe('RemoteControlComponent releasing DataService registrations', () => {
  let fixture: ComponentFixture<RemoteControlComponent>;
  let component: RemoteControlComponent;
  let dataSvc: FakeDataService;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoteControlComponent],
      providers: [{ provide: DataService, useClass: FakeDataService }]
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteControlComponent);
    component = fixture.componentInstance;
    dataSvc = TestBed.inject(DataService) as unknown as FakeDataService;
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  it('releases the previous display\'s subscriptions when the selected display switches to another one', async () => {
    pushDisplay(dataSvc, 'display-1', 'One');
    pushDisplay(dataSvc, 'display-2', 'Two');
    await appRef.whenStable();
    fixture.detectChanges();

    // display-1 sorts first alphabetically and is auto-selected; its two path
    // registrations (screen list + active screen index) should now be live.
    expect(dataSvc.unsubCalls).toEqual([]);

    component['displayDashboards']('display-2');
    await appRef.whenStable();
    fixture.detectChanges();

    expect(dataSvc.unsubCalls).toContainEqual({ path: 'self.displays.display-1', source: 'default' });
    expect(dataSvc.unsubCalls).toContainEqual({ path: 'self.displays.display-1.screenIndex', source: 'default' });
  });

  it('releases the selected display\'s subscriptions when the component is destroyed', async () => {
    pushDisplay(dataSvc, 'display-1', 'One');
    await appRef.whenStable();
    fixture.detectChanges();

    expect(dataSvc.unsubCalls).toEqual([]);

    fixture.destroy();

    expect(dataSvc.unsubCalls).toContainEqual({ path: 'self.displays.display-1', source: 'default' });
    expect(dataSvc.unsubCalls).toContainEqual({ path: 'self.displays.display-1.screenIndex', source: 'default' });
  });
});
