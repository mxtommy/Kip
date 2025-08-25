import { UnitsService } from './../../core/services/units.service';
import { Component, OnInit, input, inject } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DatasetService, IDatasetServiceDatasetConfig } from './../../core/services/data-set.service';
import { IUnitGroup } from '../../core/services/units.service';

@Component({
  selector: 'config-dataset-chart-options',
  standalone: true,
  imports: [ MatFormFieldModule, MatSelectModule, MatRadioModule, MatCheckboxModule, ReactiveFormsModule],
  templateUrl: './dataset-chart-options.component.html',
  styleUrl: './dataset-chart-options.component.scss'
})
export class DatasetChartOptionsComponent implements OnInit {
  private datasetService = inject(DatasetService);
  private units = inject(UnitsService);

  readonly datasetUUID = input.required<UntypedFormControl>();
  readonly convertUnitTo = input.required<UntypedFormControl>();
  readonly dataSource = input.required<UntypedFormControl>();
  readonly selectedStreamId = input.required<UntypedFormControl>();
  readonly streamAutoStart = input.required<UntypedFormControl>();

  public availableDataSets: IDatasetServiceDatasetConfig[] = [];
  public unitList: {default?: string, conversions?: IUnitGroup[] } = {};

  ngOnInit(): void {
    this.availableDataSets = this.datasetService.list().filter(ds => ds.editable !== false).sort();
    const datasetUUID = this.datasetUUID();
    if (datasetUUID.value) {
      this.setPathUnits(datasetUUID.value);
    }

  }

  private setPathUnits(uuid: string): boolean {
    const datasetConfig = this.datasetService.getDatasetConfig(uuid);
    if (uuid && datasetConfig) {
      this.unitList = this.units.getConversionsForPath(datasetConfig.path);
      this.convertUnitTo()?.enable();
      return true;
    } else {
      this.unitList = this.units.getConversionsForPath('');
      this.convertUnitTo()?.disable();
      return false;
    }
  }

  public datasetChanged(e: MatSelectChange): void {
    this.setPathUnits(e.value);
  }

  public dataSourceChanged(value: string): void {
    this.dataSource().setValue(value);
    
    // Update validation and reset selections when switching data source
    if (value === 'dataset') {
      this.selectedStreamId().setValue(null);
      this.selectedStreamId().clearValidators();
      this.datasetUUID().setValidators([Validators.required]);
    } else if (value === 'stream') {
      this.datasetUUID().setValue(null);
      this.datasetUUID().clearValidators();
      this.selectedStreamId().setValidators([Validators.required]);
    }
    
    // Update validity after changing validators
    this.datasetUUID().updateValueAndValidity();
    this.selectedStreamId().updateValueAndValidity();
  }


  public isDatasetMode(): boolean {
    return this.dataSource().value === 'dataset';
  }

  public isStreamMode(): boolean {
    return this.dataSource().value === 'stream';
  }
}
