import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetGaugeNgLinearComponent } from './widget-gauge-ng-linear.component';

describe('WidgetGaugeNgLinearComponent', () => {
  let component: WidgetGaugeNgLinearComponent;
  let fixture: ComponentFixture<WidgetGaugeNgLinearComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetGaugeNgLinearComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetGaugeNgLinearComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
