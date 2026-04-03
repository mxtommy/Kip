import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataInspectorComponent } from './data-inspector.component';
import { States } from '../../interfaces/signalk-interfaces';
import type { ISkPathData } from '../../interfaces/app-interfaces';

describe('DataBrowserComponent', () => {
  let component: DataInspectorComponent;
  let fixture: ComponentFixture<DataInspectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataInspectorComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DataInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should snapshot source values before binding them into the template', () => {
    const livePath: ISkPathData = {
      path: 'self.test.frequency',
      pathValue: 59.906,
      pathTimestamp: '2026-04-01T00:00:00.000Z',
      type: 'number',
      state: States.Normal,
      sources: {
        sensorA: {
          sourceTimestamp: '2026-04-01T00:00:00.000Z',
          sourceValue: 59.906
        }
      }
    };

    const viewRow = (component as unknown as { toViewRow(path: ISkPathData): { sourceRows: { value: unknown }[] } }).toViewRow(livePath);
    livePath.sources.sensorA.sourceValue = 60.086;

    expect(viewRow.sourceRows[0]?.value).toBe(59.906);
  });
});
