import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ModalWidgetConfigComponent } from './modal-widget-config.component';
import { ensureTestIconsReady } from '../../../test-helpers/icon-test-utils';

describe('ModalWidgetComponent', () => {
  let component: ModalWidgetConfigComponent;
  let fixture: ComponentFixture<ModalWidgetConfigComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [ModalWidgetConfigComponent]
})
    .compileComponents();
  }));

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
