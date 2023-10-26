import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetDateGenericComponent } from './widget-date-generic.component';

describe('WidgetDateGenericComponent', () => {
  let component: WidgetDateGenericComponent;
  let fixture: ComponentFixture<WidgetDateGenericComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetDateGenericComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetDateGenericComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
