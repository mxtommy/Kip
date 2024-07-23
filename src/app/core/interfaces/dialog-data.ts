import { ComponentType } from "@angular/cdk/portal";
import { ComponentRef } from "@angular/core";

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
