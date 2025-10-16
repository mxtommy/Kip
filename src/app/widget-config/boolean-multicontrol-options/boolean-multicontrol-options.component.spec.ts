import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormArray } from '@angular/forms';

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
    // Provide required inputs before first detectChanges
    const arr = new UntypedFormArray([]);
    fixture.componentRef.setInput('multiCtrlArray', arr);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
