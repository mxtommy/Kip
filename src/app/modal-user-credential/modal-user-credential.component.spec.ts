import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalUserCredentialComponent } from './modal-user-credential.component';

describe('ModalUserCredentialComponent', () => {
  let component: ModalUserCredentialComponent;
  let fixture: ComponentFixture<ModalUserCredentialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalUserCredentialComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalUserCredentialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
