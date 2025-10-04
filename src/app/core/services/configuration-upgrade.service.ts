import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigurationUpgradeService {

  public fromVersion(version: number): void {
    console.log(`[ConfigurationUpgradeService] Upgrading configuration from version ${version}`);
    // Add your upgrade logic here as needed for different update paths
  }

}
