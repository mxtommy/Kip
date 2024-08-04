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
  componentType?: ComponentType<any>;
}

export interface DialogNameData {
  title: string;
  name: string;
  confirmBtnText?: string;
  cancelBtnText: string;
}
