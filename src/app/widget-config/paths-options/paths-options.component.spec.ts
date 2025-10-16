import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroupDirective, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { PathsOptionsComponent } from './paths-options.component';

describe('PathsOptionsComponent', () => {
  let component: PathsOptionsComponent;
  let fixture: ComponentFixture<PathsOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PathsOptionsComponent],
      providers: [
        {
          provide: FormGroupDirective,
          useFactory: () => {
            // Build a minimal root form with required controls the component expects
            const root = new UntypedFormGroup({
              // Top-level group name we will reference via formGroupName input
              paths: new UntypedFormArray([]),
              multiChildCtrls: new UntypedFormControl([])
            });
            return { control: root } as Partial<FormGroupDirective> as FormGroupDirective;
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PathsOptionsComponent);
    component = fixture.componentInstance;
    // Provide required inputs
    const set = fixture.componentRef.setInput.bind(fixture.componentRef) as (k: string, v: unknown) => void;
    set('formGroupName', 'paths');
    set('isArray', true);
    set('enableTimeout', new UntypedFormControl(false));
    set('dataTimeout', new UntypedFormControl(0));
    set('filterSelfPaths', new UntypedFormControl(false));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
