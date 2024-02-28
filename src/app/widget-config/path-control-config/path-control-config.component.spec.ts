import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ModalPathControlConfigComponent } from './path-control-config.component';

describe('ModalPathSelectorComponent', () => {
  let component: ModalPathControlConfigComponent;
  let fixture: ComponentFixture<ModalPathControlConfigComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [ModalPathControlConfigComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalPathControlConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
