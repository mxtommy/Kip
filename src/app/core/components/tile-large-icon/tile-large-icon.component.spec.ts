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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
