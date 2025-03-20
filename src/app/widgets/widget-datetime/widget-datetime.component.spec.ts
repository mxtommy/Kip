import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetDatetimeComponent } from './widget-datetime.component';

describe('WidgetDatetimeComponent', () => {
  let component: WidgetDatetimeComponent;
  let fixture: ComponentFixture<WidgetDatetimeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetDatetimeComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetDatetimeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
