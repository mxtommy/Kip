import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NotificationMenuComponent } from './notification-menu.component';

describe('AlarmMenuComponent', () => {
  let component: NotificationMenuComponent;
  let fixture: ComponentFixture<NotificationMenuComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [NotificationMenuComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NotificationMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
