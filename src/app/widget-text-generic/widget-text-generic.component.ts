import { Component, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-widget-text-generic',
  templateUrl: './widget-text-generic.component.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericComponent implements OnInit {

  @ViewChild('svgElement') svg; 

  constructor() {
  }

  ngOnInit() {

  }

  ngAfterViewInit() {
    console.log(this.svg.nativeElement.width);
    let bbox = this.svg.nativeElement.getBBox();
    console.log(bbox);
  }


}
