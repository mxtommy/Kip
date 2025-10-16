import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetHostBottomSheetComponent } from './widget-host-bottom-sheet.component';
import { ensureTestIconsReady } from '../../../../test-helpers/icon-test-utils';

describe('WidgetHostBottomSheetComponent', () => {
  let component: WidgetHostBottomSheetComponent;
  let fixture: ComponentFixture<WidgetHostBottomSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetHostBottomSheetComponent]
    })
    .compileComponents();

    ensureTestIconsReady();
    fixture = TestBed.createComponent(WidgetHostBottomSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
