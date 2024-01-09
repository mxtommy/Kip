import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PathsOptionsComponent } from './paths-options.component';

describe('PathsOptionsComponent', () => {
  let component: PathsOptionsComponent;
  let fixture: ComponentFixture<PathsOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PathsOptionsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PathsOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
