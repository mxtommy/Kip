import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModalWidgetConfigComponent } from './modal-widget-config.component';
import { IConversionPathList, UnitsService } from '../../core/services/units.service';
import { ensureTestIconsReady } from '../../../test-helpers/icon-test-utils';

describe('ModalWidgetComponent', () => {
  let component: ModalWidgetConfigComponent;
  let fixture: ComponentFixture<ModalWidgetConfigComponent>;
  const unitsServiceStub: Pick<UnitsService, 'getConversionsForPath'> = {
    getConversionsForPath: (): IConversionPathList => ({ base: 'unitless', conversions: [] }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalWidgetConfigComponent],
      providers: [
        { provide: UnitsService, useValue: unitsServiceStub },
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    ensureTestIconsReady();
    fixture = TestBed.createComponent(ModalWidgetConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
