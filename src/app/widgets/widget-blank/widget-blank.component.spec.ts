import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetBlankComponent } from './widget-blank.component';

describe('WidgetBlankComponent', () => {
  let component: WidgetBlankComponent;
  let fixture: ComponentFixture<WidgetBlankComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetBlankComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetBlankComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
