import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetSplitComponent } from './widget-split.component';

describe('WidgetSplitComponent', () => {
  let component: WidgetSplitComponent;
  let fixture: ComponentFixture<WidgetSplitComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetSplitComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetSplitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
