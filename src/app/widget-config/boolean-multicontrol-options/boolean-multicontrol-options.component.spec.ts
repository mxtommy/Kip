import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BooleanMultiControlOptionsComponent } from './boolean-multicontrol-options.component';

describe('BooleanToggleConfigComponent', () => {
  let component: BooleanMultiControlOptionsComponent;
  let fixture: ComponentFixture<BooleanMultiControlOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [BooleanMultiControlOptionsComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(BooleanMultiControlOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
