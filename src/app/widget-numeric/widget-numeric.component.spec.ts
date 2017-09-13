import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetNumericComponent } from './widget-numeric.component';

describe('WidgetNumericComponent', () => {
  let component: WidgetNumericComponent;
  let fixture: ComponentFixture<WidgetNumericComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetNumericComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetNumericComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
