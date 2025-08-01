
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetNumericComponent } from './widget-numeric.component';

describe('WidgetNumericChartComponent', () => {
  let component: WidgetNumericComponent;
  let fixture: ComponentFixture<WidgetNumericComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetNumericComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetNumericComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
