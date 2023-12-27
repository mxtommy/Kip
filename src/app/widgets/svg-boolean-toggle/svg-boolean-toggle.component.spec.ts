import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SvgBooleanToggleComponent } from './svg-boolean-toggle.component';

describe('SvgBooleanToggleComponent', () => {
  let component: SvgBooleanToggleComponent;
  let fixture: ComponentFixture<SvgBooleanToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SvgBooleanToggleComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SvgBooleanToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
