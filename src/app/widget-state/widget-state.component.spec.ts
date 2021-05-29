import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetStateComponent } from './widget-state.component';

describe('WidgetStateComponent', () => {
  let component: WidgetStateComponent;
  let fixture: ComponentFixture<WidgetStateComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WidgetStateComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
