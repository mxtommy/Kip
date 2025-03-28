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
  protected readonly pageTitle = input<string>();
  private _router = inject(Router);

  ngAfterViewInit(): void {
    // window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  ngOnDestroy(): void {
    // window.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  // private handleKeyDown(event: KeyboardEvent): void {
  // }

  protected closePage() {
    this._router.navigate(['/dashboard']);
  }
}
