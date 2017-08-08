import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetBlankComponent } from './widget-blank.component';

describe('WidgetBlankComponent', () => {
  let component: WidgetBlankComponent;
  let fixture: ComponentFixture<WidgetBlankComponent>;

  beforeEach(async(() => {
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
