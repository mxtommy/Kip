import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'objectKeys',
    standalone: true
})
export class ObjectKeysPipe implements PipeTransform {
  transform(value: object): string[] {
    return Object.keys(value);//.map(key => value[key]);
  }
}
