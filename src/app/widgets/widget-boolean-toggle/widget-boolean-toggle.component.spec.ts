import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetBooleanToggleComponent } from './widget-boolean-toggle.component';

describe('WidgetBooleanToggleComponent', () => {
  let component: WidgetBooleanToggleComponent;
  let fixture: ComponentFixture<WidgetBooleanToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WidgetBooleanToggleComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetBooleanToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
