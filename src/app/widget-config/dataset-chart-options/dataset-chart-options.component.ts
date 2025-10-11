import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { UnitsService } from './../../core/services/units.service';
import { Component, OnInit, input, inject, signal, DestroyRef } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, UntypedFormControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DataService } from '../../core/services/data.service';
import { IUnitGroup } from '../../core/services/units.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { IPathMetaData, ISkPathData } from '../../core/interfaces/app-interfaces';
import { debounceTime } from 'rxjs';

function pathRequiredOrValidMatch(getPaths: () => IPathMetaData[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    // If pathRequired is undefined or true, path is required and must be valid
    const required = control.parent?.value?.pathRequired !== false;
    const value = control.value;
    if (required) {
      // Required: must not be empty and must match a valid path
      if (value === null || value === '') {
        return { requireMatch: true };
      }
      const allPathsAndMeta = getPaths();
      const pathFound = allPathsAndMeta.some(array => array.path === value);
      return pathFound ? null : { requireMatch: true };
    } else {
      // Not required: valid if empty, or if matches a valid path
      if (value === null || value === '') {
        return null;
      }
      const allPathsAndMeta = getPaths();
      const pathFound = allPathsAndMeta.some(array => array.path === value);
      return pathFound ? null : { requireMatch: true };
    }
  };
}
@Component({
  selector: 'config-dataset-chart-options',
  imports: [MatIconModule, MatAutocompleteModule, MatCheckboxModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, ReactiveFormsModule],
  templateUrl: './dataset-chart-options.component.html',
  styleUrl: './dataset-chart-options.component.scss'
})
export class DatasetChartOptionsComponent implements OnInit {
  public convertUnitTo = input.required<UntypedFormControl>();
  public filterSelfPaths = input.required<UntypedFormControl>()
  public datachartPath = input.required<UntypedFormControl>()
  public datachartSource = input.required<UntypedFormControl>()
  public timeScale = input.required<UntypedFormControl>();
  public period = input.required<UntypedFormControl>()

  private readonly data = inject(DataService);
  private readonly units = inject(UnitsService);
  private readonly _destroyRef = inject(DestroyRef);

  protected numericPaths = signal<IPathMetaData[]>([]);
  protected filteredNumericPaths = signal<IPathMetaData[]>([]);
  protected unitList = signal<{default?: string, conversions?: IUnitGroup[] }>({});
  protected pathSources = signal<string[]>([]);

  ngOnInit(): void {
    this.numericPaths.set(this.data.getPathsAndMetaByType('number', false, this.filterSelfPaths().value).sort());
    this.filteredNumericPaths.set(this.numericPaths());

    this.datachartPath().valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this._destroyRef)).subscribe(value => {
      const term = (value || '').toLowerCase().trim();
      if (!term) {
        this.filteredNumericPaths.set(this.numericPaths());
      } else {
        this.filteredNumericPaths.set(this.numericPaths().filter(p => p.path.toLowerCase().includes(term)));
      }
    });

    this.datachartPath().setValidators([pathRequiredOrValidMatch(() => this.getPaths())]);
    if (this.datachartPath()?.value) {
      const pathObject = this.data.getPathObject(this.datachartPath().value);
      this.setPathSources(pathObject);
      this.unitList.set(this.units.getConversionsForPath(this.datachartPath().value));
    }
    this.setInitFormState();
  }

  private setInitFormState(reset = false): void {
    if (this.datachartSource().value && !reset) {
      this.datachartSource().enable();
    } else {
      this.datachartSource().reset();
      this.datachartSource().disable();
    }

    if (this.convertUnitTo().value !== "" && !reset) {
      this.convertUnitTo().enable();
    } else {
      this.convertUnitTo().reset();
      this.convertUnitTo().disable();
    }

    if (this.timeScale().value) {
      this.timeScale().enable();
    } else {
      this.timeScale().disable();
    }

    if (this.period().value) {
      this.period().enable();
    } else {
      this.period().disable();
    }
  }

  private getPaths(): IPathMetaData[] {
    return this.data.getPathsAndMetaByType('number', false, this.filterSelfPaths().value).sort();
  }

  protected clearPathInputField(): void {
    this.datachartPath().setValue('');
    this.setInitFormState(true);
  }

  public changePath(e: MatAutocompleteSelectedEvent) { // called when we choose a new path. Resets the form old value with default info of this path
    const pathObject = this.data.getPathObject(e.option.value);
    if (pathObject === null) {
      this.pathSources.set([]);
      this.datachartSource().reset();
      this.datachartSource().disable();
      this.convertUnitTo().reset();
      this.convertUnitTo().disable();
      this.setPathUnits();
      return;
    }
    this.setPathSources(pathObject);
    this.setPathUnits(pathObject.path);
  }

  private setPathSources(pathObject: ISkPathData): void {
    if (Object.keys(pathObject.sources).length == 1) {
      this.pathSources.set(['default']);
      this.datachartSource().setValue('default');
      this.datachartSource().enable();
    } else if (Object.keys(pathObject.sources).length > 1) {
      this.pathSources.set(Object.keys(pathObject.sources).sort());
      this.datachartSource().reset();
      this.datachartSource().enable();
    }
  }

  private setPathUnits(path?: string): void {
    if (path) {
      this.unitList.set(this.units.getConversionsForPath(path));
      this.convertUnitTo().reset();
      this.convertUnitTo()?.enable();
    } else {
      this.unitList.set(this.units.getConversionsForPath(''));
      this.convertUnitTo().reset();
      this.convertUnitTo()?.disable();
    }
  }
}
