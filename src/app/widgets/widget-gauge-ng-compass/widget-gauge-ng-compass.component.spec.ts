import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetGaugeNgCompassComponent } from './widget-gauge-ng-compass.component';

describe('WidgetGaugeNgCompassComponent', () => {
  let component: WidgetGaugeNgCompassComponent;
  let fixture: ComponentFixture<WidgetGaugeNgCompassComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetGaugeNgCompassComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WidgetGaugeNgCompassComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
