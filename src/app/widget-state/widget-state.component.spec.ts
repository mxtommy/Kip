import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetStateComponent } from './widget-state.component';

describe('WidgetStateComponent', () => {
  let component: WidgetStateComponent;
  let fixture: ComponentFixture<WidgetStateComponent>;

  beforeEach(async(() => {
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
