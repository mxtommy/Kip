import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetSimpleLinearComponent } from './widget-simple-linear.component';

describe('WidgetSimpleLinearComponent', () => {
  let component: WidgetSimpleLinearComponent;
  let fixture: ComponentFixture<WidgetSimpleLinearComponent>;

  beforeEach(waitForAsync(() => {
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
