import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetButtonComponent } from './widget-button.component';

describe('WidgetButtonComponent', () => {
  let component: WidgetButtonComponent;
  let fixture: ComponentFixture<WidgetButtonComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetButtonComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
