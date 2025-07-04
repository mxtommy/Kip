import { Component, inject, OnInit } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [MarkdownComponent, MatButtonModule, MatMenuModule, MatDividerModule, MatIconModule],
  templateUrl: './app-help.component.html',
  styleUrl: './app-help.component.scss'
})
export class AppHelpComponent implements OnInit {
  protected readonly pageTitle = 'Help';
  private http = inject(HttpClient);
  private _router = inject(Router);
  protected helpFiles: { title: string; file: string }[] = [];
  protected selectedFile = '';

  ngOnInit(): void {
    this.http.get<{ title: string; file: string }[]>('assets/help-docs/menu.json')
      .subscribe({
        next: data => {
          this.helpFiles = data.filter(item => this.isValidFile(item.file));
          if (this.helpFiles.length > 0) {
            this.selectedFile = this.helpFiles[0].file; // Load first file by default
          }
        },
        error: err => {
          console.error('[Help] Failed to load help menu:', err);
          this.helpFiles = [];
        }
      });
  }

  protected selectFile(file: string): void {
    this.selectedFile = file;
  }

  private isValidFile(filePath: string): boolean {
    return filePath.endsWith('.md');
  }

  protected closePage() {
    this._router.navigate(['/dashboard']);
  }
}
