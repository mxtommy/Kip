import { ComponentFixture, TestBed } from '@angular/core/testing';

import {  LargeIconTileComponent } from './large-icon-tile.component';

describe(' LargeIconTileComponent', () => {
  let component:  LargeIconTileComponent;
  let fixture: ComponentFixture< LargeIconTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ LargeIconTileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent( LargeIconTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
