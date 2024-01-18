import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SvgBooleanLightComponent } from './svg-boolean-light.component';

describe('SvgBooleanLightComponent', () => {
  let component: SvgBooleanLightComponent;
  let fixture: ComponentFixture<SvgBooleanLightComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SvgBooleanLightComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SvgBooleanLightComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
