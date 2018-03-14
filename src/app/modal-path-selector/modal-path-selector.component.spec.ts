import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalPathSelectorComponent } from './modal-path-selector.component';

describe('ModalPathSelectorComponent', () => {
  let component: ModalPathSelectorComponent;
  let fixture: ComponentFixture<ModalPathSelectorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ModalPathSelectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalPathSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
