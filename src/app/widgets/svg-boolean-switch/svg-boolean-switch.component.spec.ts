import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SvgBooleanSwitchComponent } from './svg-boolean-switch.component';

describe('SvgBooleanToggleComponent', () => {
  let component: SvgBooleanSwitchComponent;
  let fixture: ComponentFixture<SvgBooleanSwitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SvgBooleanSwitchComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SvgBooleanSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
