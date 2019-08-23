import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetIframeComponent } from './widget-iframe.component';

describe('WidgetIframeComponent', () => {
  let component: WidgetIframeComponent;
  let fixture: ComponentFixture<WidgetIframeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetIframeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetIframeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
