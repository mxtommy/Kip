import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetSimpleLinearComponent } from './widget-simple-linear.component';

describe('WidgetSimpleLinearComponent', () => {
  let component: WidgetSimpleLinearComponent;
  let fixture: ComponentFixture<WidgetSimpleLinearComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetSimpleLinearComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetSimpleLinearComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
