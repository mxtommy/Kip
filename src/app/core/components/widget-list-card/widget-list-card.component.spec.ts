import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetListCardComponent } from './widget-list-card.component';

describe('WidgetListCardComponent', () => {
  let component: WidgetListCardComponent;
  let fixture: ComponentFixture<WidgetListCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetListCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetListCardComponent);
    component = fixture.componentInstance;
    // Provide required inputs before first detectChanges
    fixture.componentRef.setInput('svgIcon', 'dashboard-dashboard');
    fixture.componentRef.setInput('iconSize', 48);
    fixture.componentRef.setInput('name', 'Widget Name');
    fixture.componentRef.setInput('description', 'Widget description');
    fixture.componentRef.setInput('pluginsStatus', []);
    fixture.componentRef.setInput('pluginDependencyValid', true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
