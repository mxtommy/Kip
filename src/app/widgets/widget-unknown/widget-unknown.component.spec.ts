import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetUnknownComponent } from './widget-unknown.component';

describe('WidgetUnknownComponent', () => {
  let component: WidgetUnknownComponent;
  let fixture: ComponentFixture<WidgetUnknownComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetUnknownComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetUnknownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
