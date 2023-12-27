import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BooleanToggleConfigComponent } from './boolean-toggle-config.component';

describe('BooleanToggleConfigComponent', () => {
  let component: BooleanToggleConfigComponent;
  let fixture: ComponentFixture<BooleanToggleConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BooleanToggleConfigComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BooleanToggleConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
