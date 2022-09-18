import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetRaceTimerComponent } from './widget-race-timer.component';

describe('WidgetRaceTimerComponent', () => {
  let component: WidgetRaceTimerComponent;
  let fixture: ComponentFixture<WidgetRaceTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WidgetRaceTimerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetRaceTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
