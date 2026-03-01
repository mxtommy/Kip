import { TestBed } from '@angular/core/testing';
import { WidgetDatasetOrchestratorService } from './widget-dataset-orchestrator.service';
import { DatasetStreamService, IDatasetServiceDatasetConfig } from './dataset-stream.service';
import { IWidgetSvcConfig } from '../interfaces/widgets-interface';

describe('WidgetDatasetOrchestratorService', () => {
  let service: WidgetDatasetOrchestratorService;
  let datasetSpy: jasmine.SpyObj<DatasetStreamService>;

  beforeEach(() => {
    datasetSpy = jasmine.createSpyObj<DatasetStreamService>('DatasetStreamService', [
      'getDatasetConfig',
      'create',
      'edit',
      'removeIfExists',
      'list'
    ]);

    TestBed.configureTestingModule({
      providers: [
        WidgetDatasetOrchestratorService,
        { provide: DatasetStreamService, useValue: datasetSpy }
      ]
    });

    service = TestBed.inject(WidgetDatasetOrchestratorService);
  });

  it('creates Data Chart dataset when missing', () => {
    datasetSpy.getDatasetConfig.and.returnValue(undefined);

    const cfg = {
      datachartPath: ' navigation.speedThroughWater ',
      datachartSource: '',
      timeScale: 'minute',
      period: 10
    } as unknown as IWidgetSvcConfig;

    service.syncDataChartDataset('widget-1', cfg, 'sig-1');

    expect(datasetSpy.create).toHaveBeenCalledWith(
      'navigation.speedThroughWater',
      'default',
      'minute',
      10,
      'sig-1',
      true,
      false,
      'widget-1'
    );
  });

  it('edits existing Data Chart dataset when config changes', () => {
    const existing: IDatasetServiceDatasetConfig = {
      uuid: 'widget-1',
      path: 'navigation.speedOverGround',
      pathSource: 'default',
      baseUnit: 'number',
      timeScaleFormat: 'minute',
      period: 5,
      label: 'old-label',
      editable: false
    };

    datasetSpy.getDatasetConfig.and.returnValue(existing);

    const cfg = {
      datachartPath: 'navigation.speedThroughWater',
      datachartSource: 'src-1',
      timeScale: 'minute',
      period: 10
    } as unknown as IWidgetSvcConfig;

    service.syncDataChartDataset('widget-1', cfg, 'sig-1');

    expect(datasetSpy.edit).toHaveBeenCalledWith(
      {
        ...existing,
        path: 'navigation.speedThroughWater',
        pathSource: 'src-1',
        timeScaleFormat: 'minute',
        period: 10,
        label: 'sig-1',
        editable: false
      },
      true
    );
  });

  it('does not create Numeric mini-chart dataset when path is empty', () => {
    service.syncNumericMiniChartDataset('widget-2', '   ', 'default');

    expect(datasetSpy.create).not.toHaveBeenCalled();
    expect(datasetSpy.edit).not.toHaveBeenCalled();
  });

  it('creates both Windtrends datasets when missing', () => {
    datasetSpy.getDatasetConfig.and.returnValue(undefined);

    service.syncWindTrendsDatasets('widget-wind-1', 'Last 30 Minutes');

    expect(datasetSpy.create).toHaveBeenCalledWith(
      'self.environment.wind.directionTrue',
      'default',
      'Last 30 Minutes',
      30,
      'windtrends-widget-wind-1',
      true,
      false,
      'widget-wind-1-twd'
    );

    expect(datasetSpy.create).toHaveBeenCalledWith(
      'self.environment.wind.speedTrue',
      'default',
      'Last 30 Minutes',
      30,
      'speedtrends-widget-wind-1',
      true,
      false,
      'widget-wind-1-tws'
    );
  });

  it('removes owned datasets by exact uuid and prefix', () => {
    datasetSpy.list.and.returnValue([
      { uuid: 'widget-abc' } as IDatasetServiceDatasetConfig,
      { uuid: 'widget-abc-twd' } as IDatasetServiceDatasetConfig,
      { uuid: 'widget-other' } as IDatasetServiceDatasetConfig
    ]);

    service.removeOwnedDatasets('widget-abc', true);

    expect(datasetSpy.removeIfExists).toHaveBeenCalledWith('widget-abc', true);
    expect(datasetSpy.removeIfExists).toHaveBeenCalledWith('widget-abc-twd', true);
    expect(datasetSpy.removeIfExists).not.toHaveBeenCalledWith('widget-other', true);
  });

  it('forwards removeDatasetIfExists to DatasetStreamService', () => {
    service.removeDatasetIfExists('widget-9', false);

    expect(datasetSpy.removeIfExists).toHaveBeenCalledWith('widget-9', false);
  });
});
