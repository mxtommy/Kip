import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetHistoricalComponent } from './widget-historical.component';

describe('WidgetHistoricalComponent', () => {
  let component: WidgetHistoricalComponent;
  let fixture: ComponentFixture<WidgetHistoricalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetHistoricalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetHistoricalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
