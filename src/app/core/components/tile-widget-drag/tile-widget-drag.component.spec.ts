import { ComponentFixture, TestBed } from '@angular/core/testing';

import {  TileWidgetDragComponent } from './tile-widget-drag.component';

describe(' TileWidgetDragComponent', () => {
  let component:  TileWidgetDragComponent;
  let fixture: ComponentFixture< TileWidgetDragComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ TileWidgetDragComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent( TileWidgetDragComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
