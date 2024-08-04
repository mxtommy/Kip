import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MenuNotificationsComponent } from './menu-notifications.component';

describe('AlarmMenuComponent', () => {
  let component: MenuNotificationsComponent;
  let fixture: ComponentFixture<MenuNotificationsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [MenuNotificationsComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MenuNotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
