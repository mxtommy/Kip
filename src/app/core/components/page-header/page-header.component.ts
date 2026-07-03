import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'page-header',
  standalone: true,
  imports: [ MatButtonModule, MatIconModule ],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
  protected readonly pageTitle = input.required<string>();
  protected readonly svgIconId = input.required<string>();
  private _router = inject(Router);

  protected backPage() {
    this._router.navigate(['/settings']);
  }

  protected closePage() {
    this._router.navigate(['/dashboard']);
  }
}
