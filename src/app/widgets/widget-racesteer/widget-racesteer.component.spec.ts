
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetRacesteerComponent } from './widget-racesteer.component';

describe('WidgetRacesteerComponent', () => {
  let component: WidgetRacesteerComponent;
  let fixture: ComponentFixture<WidgetRacesteerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetRacesteerComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetRacesteerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
