import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterSelf'
})
export class FilterSelfPipe implements PipeTransform {

  transform(values: string[], filterSelf: boolean): any[] {
    if (!values || !values.length) return [];
    if (!filterSelf) return values;
    return values.filter(v =>  v.includes('self'));
  }

}
