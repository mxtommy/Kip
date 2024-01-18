import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SvgBooleanButtonComponent } from './svg-boolean-button.component';

describe('SvgBooleanButtonComponent', () => {
  let component: SvgBooleanButtonComponent;
  let fixture: ComponentFixture<SvgBooleanButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SvgBooleanButtonComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SvgBooleanButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
