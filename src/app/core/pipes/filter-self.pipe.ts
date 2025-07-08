import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'filterSelf',
    standalone: true
})
export class FilterSelfPipe implements PipeTransform {

  transform(values: string[], filterSelf: boolean): string[] {
    if (!values || !values.length) return [];
    if (!filterSelf) return values;
    return values.filter(v =>  v.includes('self'));
  }

}
