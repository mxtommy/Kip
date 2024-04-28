import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetGaugeComponent } from './widget-gauge-steel.component';

describe('WidgetGaugeComponent', () => {
  let component: WidgetGaugeComponent;
  let fixture: ComponentFixture<WidgetGaugeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetGaugeComponent]
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
