import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GaugeSteelComponent } from './gauge-steel.component';
import { UnitsService } from '../../core/services/units.service';

describe('GaugeSteelComponent', () => {
  let component: GaugeSteelComponent;
  let fixture: ComponentFixture<GaugeSteelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GaugeSteelComponent],
      providers: [
        {
          provide: UnitsService,
          useValue: {
            convertToUnit: (_unit: string, value: number) => value,
          },
        },
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GaugeSteelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
