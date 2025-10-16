import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl } from '@angular/forms';

import { DisplayDatetimeComponent } from './display-datetime.component';

describe('DisplayDatetimeComponent', () => {
  let component: DisplayDatetimeComponent;
  let fixture: ComponentFixture<DisplayDatetimeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [DisplayDatetimeComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(DisplayDatetimeComponent);
    component = fixture.componentInstance;
    // Provide required inputs before first detectChanges
    fixture.componentRef.setInput('dateFormat', new UntypedFormControl('HH:mm'));
    fixture.componentRef.setInput('dateTimezone', new UntypedFormControl('UTC'));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
