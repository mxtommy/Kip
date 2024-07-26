import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavControlComponent } from './nav-control.component';

describe('NavControlComponent', () => {
  let component: NavControlComponent;
  let fixture: ComponentFixture<NavControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavControlComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
