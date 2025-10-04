import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ConfigurationUpgradeService } from '../../services/configuration-upgrade.service';

@Component({
  selector: 'upgrade-config',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './upgrade-config.component.html',
  styleUrl: './upgrade-config.component.scss'
})
export class UpgradeConfigComponent {
  protected dialogRef = inject<MatDialogRef<UpgradeConfigComponent>>(MatDialogRef);
  private upgradeSvc = inject(ConfigurationUpgradeService);

  protected upgrade(): void {
    this.upgradeSvc.runUpgrade(undefined);
  }

  protected startFresh(): void {
    this.upgradeSvc.startFresh(); this.dialogRef.close();
  }
}
