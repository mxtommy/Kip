import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { WidgetRacerTimerComponent } from './widget-racer-timer.component';

describe('WidgetRacerTimerComponent', () => {
  let component: WidgetRacerTimerComponent;
  let fixture: ComponentFixture<WidgetRacerTimerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [WidgetRacerTimerComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetRacerTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
