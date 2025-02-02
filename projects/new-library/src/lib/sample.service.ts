import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SampleService {
  constructor() { }

  getSampleData(): string {
    return 'This is sample data from the SampleService.';
  }

  getAdditionalData(): string {
    return 'This is additional data from the SampleService.';
  }
}
