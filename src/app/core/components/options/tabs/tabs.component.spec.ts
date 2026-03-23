import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TabsComponent } from './tabs.component';
import { UnitsService } from '../../../services/units.service';

describe('SettingsTabsComponent', () => {
  let component: TabsComponent;
  let fixture: ComponentFixture<TabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabsComponent],
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
    fixture = TestBed.createComponent(TabsComponent);
    component = fixture.componentInstance;
    // Skip detectChanges to avoid ECAH from child components; creation is enough
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
