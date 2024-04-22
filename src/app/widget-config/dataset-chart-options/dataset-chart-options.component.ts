import { UnitsService } from './../../core/services/units.service';
import { Component, Input, OnInit } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { DatasetService, IDatasetServiceDatasetConfig } from './../../core/services/data-set.service';
import { IUnitGroup } from '../../core/services/units.service';

@Component({
  selector: 'config-dataset-chart-options',
  standalone: true,
  imports: [ MatFormFieldModule, MatSelectModule, ReactiveFormsModule],
  templateUrl: './dataset-chart-options.component.html',
  styleUrl: './dataset-chart-options.component.scss'
})
export class DatasetChartOptionsComponent implements OnInit {
  @Input () datasetUUID!: UntypedFormControl;
  @Input () convertUnitTo!: UntypedFormControl;

  public availableDataSets: IDatasetServiceDatasetConfig[] = [];
  public unitList: {default?: string, conversions?: IUnitGroup[] } = {};

  constructor(
    private datasetService: DatasetService,
    private units: UnitsService
  ) {}

    ngOnInit(): void {
      this.availableDataSets = this.datasetService.list().sort();
      if (this.datasetUUID.value) {
        this.setPathUnits(this.datasetUUID.value);
        this.convertUnitTo.enable();
      } else {
        this.convertUnitTo.disable();
      }
    }

    private setPathUnits(uuid: string): void {
      this.convertUnitTo.enable();
      if (uuid) {
        this.unitList = this.units.getConversionsForPath(this.datasetService.getDatasetConfig(uuid).path);
      } else {
        this.unitList = this.units.getConversionsForPath('');
      }
    }

    public datasetChanged(e: MatSelectChange): void {
      this.setPathUnits(e.value);
    }

}
