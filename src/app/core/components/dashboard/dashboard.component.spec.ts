import { ComponentFixture, TestBed } from '@angular/core/testing';
import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should enable all required disabled plugins and add widget when toast action is clicked', fakeAsync(() => {
    const action$ = new Subject<void>();
    const toastRefMock = {
      onAction: () => action$.asObservable()
    } as never;

    const widget = {
      name: 'Anchor Watch',
      requiredPlugins: ['anchoralarm', 'tracks'],
      optionalPlugins: [],
      description: 'test',
      icon: 'icon',
      category: 'Component',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 1,
      defaultHeight: 1,
      selector: 'widget-anchor-alarm',
      componentClassName: 'WidgetAnchorAlarmComponent'
    } as any;

    const toastShowSpy = spyOn((component as any)['toast'], 'show').and.returnValue(toastRefMock);
    const setPluginEnabledSpy = spyOn((component as any)['_pluginConfig'], 'setPluginEnabled')
      .and.callFake(() => Promise.resolve({ ok: true } as any));
    const addWidgetToGridSpy = spyOn(component as any, 'addWidgetToGrid').and.stub();

    (component as any).promptEnableRequiredPlugins(widget, 4, 6, ['anchoralarm', 'tracks']);
    action$.next();
    flushMicrotasks();

    expect(toastShowSpy).toHaveBeenCalled();
    expect(setPluginEnabledSpy).toHaveBeenCalledWith('anchoralarm', true);
    expect(setPluginEnabledSpy).toHaveBeenCalledWith('tracks', true);
    expect(addWidgetToGridSpy).toHaveBeenCalledWith(widget, 4, 6);
  }));
});
