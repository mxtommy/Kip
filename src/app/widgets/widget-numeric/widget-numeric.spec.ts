
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetNumericChartComponent } from './widget-numeric.component';

describe('WidgetNumericChartComponent', () => {
  let component: WidgetNumericChartComponent;
  let fixture: ComponentFixture<WidgetNumericChartComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetNumericChartComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetNumericChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
