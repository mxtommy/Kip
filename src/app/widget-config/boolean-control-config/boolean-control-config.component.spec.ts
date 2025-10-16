import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';

import { BooleanControlConfigComponent } from './boolean-control-config.component';

describe('BooleanControlConfigComponent', () => {
  let component: BooleanControlConfigComponent;
  let fixture: ComponentFixture<BooleanControlConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [BooleanControlConfigComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(BooleanControlConfigComponent);
    component = fixture.componentInstance;

    // Provide required inputs
    const formGroup = new UntypedFormGroup({
      ctrlLabel: new UntypedFormControl('Test Label', { validators: [Validators.required] }),
      type: new UntypedFormControl('1', { validators: [Validators.required] }),
      color: new UntypedFormControl('contrast', { validators: [Validators.required] }),
      isNumeric: new UntypedFormControl(false),
      pathID: new UntypedFormControl('uuid-1')
    });

    fixture.componentRef.setInput('ctrlFormGroup', formGroup);
    fixture.componentRef.setInput('controlIndex', 0);
    fixture.componentRef.setInput('arrayLength', 1);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
