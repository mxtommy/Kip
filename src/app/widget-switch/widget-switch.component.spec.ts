import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetSwitchComponent } from './widget-switch.component';

describe('WidgetSwitchComponent', () => {
  let component: WidgetSwitchComponent;
  let fixture: ComponentFixture<WidgetSwitchComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetSwitchComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
