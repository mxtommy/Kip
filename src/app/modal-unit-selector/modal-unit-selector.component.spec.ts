import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalUnitSelectorComponent } from './modal-unit-selector.component';

describe('ModalUnitSelectorComponent', () => {
  let component: ModalUnitSelectorComponent;
  let fixture: ComponentFixture<ModalUnitSelectorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ModalUnitSelectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalUnitSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
