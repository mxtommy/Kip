import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'dashboard-editor',
  standalone: true,
  imports: [ MatListModule, MatIconModule],
  templateUrl: './dashboard-editor.component.html',
  styleUrl: './dashboard-editor.component.scss'
})
export class DashboardEditorComponent {

}
