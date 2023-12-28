import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BooleanMultiControlConfigComponent } from './boolean-multicontrol-config.component';

describe('BooleanToggleConfigComponent', () => {
  let component: BooleanMultiControlConfigComponent;
  let fixture: ComponentFixture<BooleanMultiControlConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BooleanMultiControlConfigComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BooleanMultiControlConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
