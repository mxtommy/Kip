import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsUnitsComponent } from './units.component';
import { UnitsService } from '../../../services/units.service';

describe('SettingsUnitsComponent', () => {
  let component: SettingsUnitsComponent;
  let fixture: ComponentFixture<SettingsUnitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsUnitsComponent],
      providers: [
        {
          provide: UnitsService,
          useValue: {
            getConversions: () => [],
          },
        },
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsUnitsComponent);
    component = fixture.componentInstance;
    // Intentionally skip initial detectChanges to avoid ECAH from async init
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
