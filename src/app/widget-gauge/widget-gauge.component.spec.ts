import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetGaugeComponent } from './widget-gauge.component';

describe('WidgetGaugeComponent', () => {
  let component: WidgetGaugeComponent;
  let fixture: ComponentFixture<WidgetGaugeComponent>;

  beforeEach(async(() => {
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
