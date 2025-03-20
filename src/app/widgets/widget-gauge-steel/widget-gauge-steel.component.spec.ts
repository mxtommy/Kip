import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetSteelGaugeComponent } from './widget-gauge-steel.component';

describe('WidgetGaugeComponent', () => {
  let component: WidgetSteelGaugeComponent;
  let fixture: ComponentFixture<WidgetSteelGaugeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetSteelGaugeComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetSteelGaugeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
