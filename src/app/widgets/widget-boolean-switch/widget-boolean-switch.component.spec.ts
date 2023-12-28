import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetBooleanSwitchComponent } from './widget-boolean-switch.component';

describe('WidgetBooleanSwitchComponent', () => {
  let component: WidgetBooleanSwitchComponent;
  let fixture: ComponentFixture<WidgetBooleanSwitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WidgetBooleanSwitchComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetBooleanSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
