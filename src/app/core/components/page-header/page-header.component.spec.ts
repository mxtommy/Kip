import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PageHeaderComponent } from './page-header.component';
import { ensureTestIconsReady } from '../../../../test-helpers/icon-test-utils';

describe('PageHeaderComponent', () => {
  let component: PageHeaderComponent;
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    ensureTestIconsReady();
    fixture = TestBed.createComponent(PageHeaderComponent);
    component = fixture.componentInstance;
    // Provide required inputs before first detectChanges
    fixture.componentRef.setInput('pageTitle', 'Test Header');
    fixture.componentRef.setInput('svgIconId', 'dashboard-dashboard');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
