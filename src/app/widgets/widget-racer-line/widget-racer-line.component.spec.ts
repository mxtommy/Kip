import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetRacerLineComponent } from './widget-racer-line.component';

describe('WidgetRacerLineComponent', () => {
  let component: WidgetRacerLineComponent;
  let fixture: ComponentFixture<WidgetRacerLineComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetRacerLineComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetRacerLineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
