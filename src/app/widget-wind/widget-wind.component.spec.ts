import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetWindComponent } from './widget-wind.component';

describe('WidgetWindComponent', () => {
  let component: WidgetWindComponent;
  let fixture: ComponentFixture<WidgetWindComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetWindComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetWindComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
