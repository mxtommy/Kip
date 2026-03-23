import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SelectIconComponent } from './select-icon.component';

describe('SelectIconComponent', () => {
  let component: SelectIconComponent;
  let fixture: ComponentFixture<SelectIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectIconComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
