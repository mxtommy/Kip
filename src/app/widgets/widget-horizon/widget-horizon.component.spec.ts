import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetHorizonComponent } from './widget-horizon.component';

describe('WidgetGaugeComponent', () => {
  let component: WidgetHorizonComponent;
  let fixture: ComponentFixture<WidgetHorizonComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetHorizonComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetHorizonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
