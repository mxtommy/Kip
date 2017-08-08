import { Component, OnInit, Input } from '@angular/core';
import {NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';

import { TreeManagerService } from '../tree-manager.service';


@Component({
  selector: 'app-unit-window',
  templateUrl: './unit-window.component.html',
  styleUrls: ['./unit-window.component.css']
})
export class UnitWindowComponent implements OnInit {
  @Input('unlockStatus') unlockStatus: string;
  @Input('nodeGUID') nodeGUID: string;

  constructor(private modalService: NgbModal, private treeManager: TreeManagerService) {}

  closeResult: string;


  open(content) {
    this.modalService.open(content).result.then((result) => {
      this.closeResult = `Closed with: ${result}`;
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return  `with: ${reason}`;
    }
  }

  ngOnInit() {
  }


}
