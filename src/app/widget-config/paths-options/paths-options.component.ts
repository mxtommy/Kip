import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';

@Component({
  selector: 'paths-options',
  templateUrl: './paths-options.component.html',
  styleUrls: ['./paths-options.component.css']
})
export class PathsOptionsComponent implements OnInit {
  @Input() enableTimeout!: UntypedFormControl;
  @Input() dataTimeout!: UntypedFormControl;
  @Input() pathFormGroups!: UntypedFormGroup;
  @Input() filterSelfPaths!: UntypedFormControl;

  constructor() { }

  ngOnInit(): void {
  }

}
