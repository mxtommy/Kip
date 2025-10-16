import { ComponentFixture, TestBed } from '@angular/core/testing';

import {  TileLargeIconComponent } from './tile-large-icon.component';

describe(' TileLargeIconComponent', () => {
  let component:  TileLargeIconComponent;
  let fixture: ComponentFixture< TileLargeIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ TileLargeIconComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent( TileLargeIconComponent);
    component = fixture.componentInstance;
    // Provide required inputs before first detectChanges
    fixture.componentRef.setInput('svgIcon', 'dashboard-dashboard');
    fixture.componentRef.setInput('iconSize', 48);
    fixture.componentRef.setInput('label', 'Dashboard');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
