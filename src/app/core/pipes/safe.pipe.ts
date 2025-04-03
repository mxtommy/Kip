import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';


@Pipe({
    name: 'safe',
    standalone: true
})

export class SafePipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(url) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

}