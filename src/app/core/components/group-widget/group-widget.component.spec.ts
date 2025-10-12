import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupWidgetComponent } from './group-widget.component';

describe('GroupWidgetComponent', () => {
  let component: GroupWidgetComponent;
  let fixture: ComponentFixture<GroupWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupWidgetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
