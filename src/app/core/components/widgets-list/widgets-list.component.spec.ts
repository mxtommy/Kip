import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WidgetsListComponent } from './widgets-list.component';

describe('WidgetsListComponent', () => {
  let component: WidgetsListComponent;
  let fixture: ComponentFixture<WidgetsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
