import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetRacerTimerComponent } from './widget-racer-timer.component';

describe('WidgetRacerTimerComponent', () => {
  let component: WidgetRacerTimerComponent;
  let fixture: ComponentFixture<WidgetRacerTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [WidgetRacerTimerComponent]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetRacerTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
