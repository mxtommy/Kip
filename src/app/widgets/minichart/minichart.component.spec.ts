import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinichartComponent } from './minichart.component';

describe('MinichartComponent', () => {
  let component: MinichartComponent;
  let fixture: ComponentFixture<MinichartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinichartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MinichartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
