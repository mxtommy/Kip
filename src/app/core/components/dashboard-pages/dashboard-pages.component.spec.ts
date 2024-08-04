import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardPagesComponent } from './dashboard-pages.component';

describe('DashboardPagesComponent', () => {
  let component: DashboardPagesComponent;
  let fixture: ComponentFixture<DashboardPagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPagesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
