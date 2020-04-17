import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetGaugeNgRadialComponent } from './widget-gauge-ng-radial.component';

describe('WidgetGaugeNgRadialComponent', () => {
  let component: WidgetGaugeNgRadialComponent;
  let fixture: ComponentFixture<WidgetGaugeNgRadialComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetGaugeNgRadialComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetGaugeNgRadialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
