import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetUnknownComponent } from './widget-unknown.component';

describe('WidgetUnknownComponent', () => {
  let component: WidgetUnknownComponent;
  let fixture: ComponentFixture<WidgetUnknownComponent>;

  beforeEach(async(() => {
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
