import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetGaugeComponent } from './widget-gauge.component';

describe('WidgetGaugeComponent', () => {
  let component: WidgetGaugeComponent;
  let fixture: ComponentFixture<WidgetGaugeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetGaugeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetGaugeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
