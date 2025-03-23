import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationBadgeComponent } from './notification-badge.component';

describe('NotificationBadgeComponent', () => {
  let component: NotificationBadgeComponent;
  let fixture: ComponentFixture<NotificationBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBadgeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
