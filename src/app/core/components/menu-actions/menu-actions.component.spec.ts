import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuActionsComponent } from './menu-actions.component';

describe('MenuActionsComponent', () => {
  let component: MenuActionsComponent;
  let fixture: ComponentFixture<MenuActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuActionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuActionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
