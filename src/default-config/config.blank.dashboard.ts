import { Dashboard } from '../app/core/services/dashboard.service';

export const DefaultDashboard: Dashboard[] = [
    {
      id: null,
      name: 'Dashboard 1',
      icon: 'dashboard-dashboard',
      configuration: [
        {
          "w": 24,
          "h": 24,
          "id": "d1d58e6f-f8b4-4a72-9597-7f92aa6776fc",
          "selector": "widget-host2",
          "input": {
            "widgetProperties": {
              "type": "widget-tutorial",
              "uuid": "d1d58e6f-f8b4-4a72-9597-7f92aa6776fc"
            }
          },
          "x": 0,
          "y": 0
        }
      ],
      collapseSplitShell: false
    }
  ];
