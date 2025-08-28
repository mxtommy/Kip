import { ComponentType } from "@angular/cdk/portal";

export interface DialogConfirmationData {
  title: string;
  message: string;
  confirmBtnText?: string;
  cancelBtnText: string;
}

export interface DialogComponentData {
  title: string;
  component: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentType?: ComponentType<any>;
}

export interface DialogNameData {
  title: string;
  name: string;
  confirmBtnText?: string;
  cancelBtnText: string;
}

export interface DialogDashboardPageEditorData {
  title: string;
  name: string;
  icon?: string;
  confirmBtnText?: string;
  cancelBtnText: string;
}

export interface DialogWidgetOptionsData {
  title: string;
  config: object;
  confirmBtnText: string;
  cancelBtnText: string;
}
