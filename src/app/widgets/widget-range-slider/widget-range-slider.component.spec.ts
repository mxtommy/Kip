import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetRangeSliderComponent } from './widget-range-slider.component';

describe('WidgetRangeSliderComponent', () => {
  let component: WidgetRangeSliderComponent;
  let fixture: ComponentFixture<WidgetRangeSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetRangeSliderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetRangeSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
