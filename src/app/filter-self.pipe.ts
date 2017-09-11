import { Pipe, PipeTransform } from '@angular/core';

import { pathObject } from './signalk.service';

@Pipe({
  name: 'filterSelf'
})
export class FilterSelfPipe implements PipeTransform {

  transform(values: pathObject[], filterSelf: boolean): any[] {
    if (!values || !values.length) return [];
    if (!filterSelf) return values;
    return values.filter(v =>  v.path.includes('self'));
  }

}
