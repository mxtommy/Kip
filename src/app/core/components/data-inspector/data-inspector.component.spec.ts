import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DataInspectorComponent } from './data-inspector.component';

describe('DataBrowserComponent', () => {
  let component: DataInspectorComponent;
  let fixture: ComponentFixture<DataInspectorComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [DataInspectorComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DataInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
