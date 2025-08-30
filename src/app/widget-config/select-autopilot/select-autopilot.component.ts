/**
 * SelectAutopilotComponent
 *
 * Manages Signal K autopilot API detection, instance selection, and configuration.
 *
 * Features:
 * - Detects available autopilot API version (prefers V2, falls back to V1 plugin).
 * - Discovers autopilot instances and supported modes.
 * - Updates the provided reactive form group with API version, plugin ID, and supported modes.
 * - Handles UI state for discovery progress and error overlays.
 * - Provides selection UI for autopilot instance and configuration options.
 *
 * State Management:
 * - Uses Angular signals for API version, available autopilots, plugin ID, discovery progress, and errors.
 * - Updates the reactive form group (`autopilotFormGroup`) with detected values.
 *
 * Methods:
 * - ngOnInit: Initializes the form group and starts API detection.
 * - detectAutopilotApi: Orchestrates API version detection and instance discovery.
 * - checkV2Api: Checks if the V2 API endpoint is available.
 * - discoverV2Autopilots: Retrieves available V2 autopilot instances.
 * - discoverV2AutopilotOptions: Gets supported modes and states for a selected instance.
 * - onAutopilotInstanceIdChange: Handles instance selection and updates modes in the form.
 * - makeHttpRequest: Manages HTTP requests with cancellation and tracking.
 *
 * Usage:
 * - Used in widget configuration to allow users to select and configure autopilot options.
 * - Integrates with Angular Reactive Forms and Material
 */
import { Component, computed, DestroyRef, effect, inject, input, OnInit, signal } from '@angular/core';
import { SignalkPluginsService } from '../../core/services/signalk-plugins.service';
import { IV2AutopilotOptionsResponse, IV2AutopilotProvider } from '../../core/interfaces/signalk-autopilot-interfaces';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Observable, finalize } from 'rxjs';
import { FormGroupDirective, UntypedFormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TitleCasePipe } from '@angular/common';
import { MatInputModule } from '@angular/material/input';

// Shared constants for API paths and configuration
const API_PATHS = {
  V1_PLUGIN: 'autopilot',
  V2_BASE: '/signalk/v2/api',
  V2_AUTOPILOTS: '/signalk/v2/api/vessels/self/autopilots',
  V2_DEFAULT_AUTOPILOT_ID: "/signalk/v2/api/vessels/self/autopilots/_providers/_default",
} as const;

const FAILSAFE_OPTIONS_RESPONSE: IV2AutopilotOptionsResponse = {
  options: {
    modes: [],
    states: []
  },
  state: null,
  mode: 'off-line',
  target: null,
  engaged: false
};

@Component({
  selector: 'select-autopilot',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatCheckboxModule, MatSelectModule, MatInputModule, TitleCasePipe],
  templateUrl: './select-autopilot.component.html',
  styleUrl: './select-autopilot.component.scss'
})
export class SelectAutopilotComponent implements OnInit {
readonly formGroupName = input.required<string>();
private readonly _plugins = inject(SignalkPluginsService);
private readonly _destroyRef = inject(DestroyRef);
private readonly http = inject(HttpClient);

private rootFormGroup = inject(FormGroupDirective);
protected autopilotFormGroup: UntypedFormGroup;

// API Version Detection
protected apiVersion = signal<'v1' | 'v2' | null>(null);
protected availableAutopilots = signal<IV2AutopilotProvider>({});
protected autopilotPlugin = signal<string | null>(null);
protected discoveryInProgress = signal<boolean>(false);
protected apiDetectionError = signal<string | null>(null);
protected apInstances = computed(() => {
  const autopilots = this.availableAutopilots();
  return autopilots ? Object.keys(autopilots) : [];
});
protected readonly modes = signal<string | null>(null);
protected readonly pluginId = signal<string | null>(null);

// Request management
private currentRequests = new Set<Observable<unknown>>();

constructor() {
  effect(() => {
    this.autopilotFormGroup.get('apiVersion')?.setValue(this.apiVersion(), { emitEvent: false });
  });
}

ngOnInit(): void {
  this.autopilotFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
  this.modes.set(this.autopilotFormGroup.value.modes || null);
  this.detectAutopilotApi();
}

/**
   * Detects available autopilot API version and configures endpoints
   *
   * Detection Logic:
   * 1. First attempts V2 API detection via /signalk/v2/api/vessels/self/autopilots
   * 2. If V2 available, discovers autopilot instances and capabilities
   * 3. Falls back to V1 plugin detection (signalk-autopilot)
   * 4. Sets persistent error state if no API found
   *
   * State Management:
   * - Sets discoveryInProgress during detection
   * - Updates apiVersion signal with detected version
   * - Configures v2Endpoints for discovered instances
   * - Handles error overlays for offline state
   *
   * @returns Promise<void> Resolves when detection complete
   * @throws Never throws - all errors handled internally
   */
  private async detectAutopilotApi(): Promise<void> {
    this.discoveryInProgress.set(true);
    console.log('[Autopilot Options] Starting API detection...');

    try {
      // Try V2 API first - check for autopilots endpoint
      const v2Available = await this.checkV2Api();
      if (v2Available) {
        this.apiVersion.set('v2');
        this.autopilotFormGroup.get('apiVersion')?.setValue('v2', { emitEvent: false });

        // Check if there is at least one autopilot provider
        if (this.availableAutopilots() && Object.keys(this.availableAutopilots()).length > 0) {
          this.pluginId.set(Object.values(this.availableAutopilots())[0]?.provider ?? null);
          this.autopilotFormGroup.get('pluginId')?.setValue(this.pluginId(), { emitEvent: false });
          this.discoveryInProgress.set(false);
          return;
        } else {
          console.warn('[Autopilot Options] No V2 autopilot provider found');
        }
      }
    } catch (error) {
      console.error('[Autopilot Options] Error checking V2 API, checking V1...', error);
    }

    try {
      // Fall back to V1 plugin detection
      const v1Enabled = await this._plugins.isEnabled(API_PATHS.V1_PLUGIN);
      if (v1Enabled) {
        this.apiVersion.set('v1');
        this.autopilotFormGroup.get('apiVersion')?.setValue("v1", { emitEvent: false });
        this.availableAutopilots.set({"Default Autopilot":{"provider":"Signal K Autopilot","isDefault":true}});
        this.pluginId.set("Signal K Autopilot");
        this.autopilotFormGroup.get('pluginId')?.setValue("Signal K Autopilot", { emitEvent: false });
        console.log('[Autopilot Options] V1 API Signal K Autopilot plugin detected');
        this.discoveryInProgress.set(false);
        return;
      }
      console.log('[Autopilot Options] V1 API plugin (signalk-autopilot) not found')
    } catch (error) {
      console.error('[Autopilot Options] V1 plugin detection failed:', error);
    }

    // No API available
    console.warn('[Autopilot Options] No Autopilot detected');
    this.discoveryInProgress.set(false);
  }

  private async checkV2Api(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.makeHttpRequest(
          this.http.get<IV2AutopilotProvider>(API_PATHS.V2_AUTOPILOTS, {observe: 'response', responseType: 'json'})
        )
      );
      // Check if there is at least one autopilot provider
      if (response && response.body && Object.keys(response.body).length > 0) {
        this.availableAutopilots.set(response.body);
        console.log('[Autopilot Options] Discovered V2 API autopilot providers:', JSON.stringify(response.body));
      } else {
        this.availableAutopilots.set({});
        console.warn('[Autopilot Options] No V2 autopilot provider plugin found.');
      }
      return response?.status === 200;
    } catch (error) {
      // Differentiate between network errors and 404s
      if (error && typeof error === 'object' && 'status' in error) {
        const httpError = error as {status: number, statusText?: string};
        if (httpError.status === 404) {
          console.log('[Autopilot Options] V2 API endpoint not found (404)');
        } else if (httpError.status >= 500) {
          console.warn('[Autopilot Options] V2 API server error:', httpError.status, httpError.statusText);
        } else {
          console.log('[Autopilot Options] V2 API call to discover Autopilot Providers failed:', httpError.status, httpError.statusText);
        }
      } else {
        console.log('[Autopilot Options] V2 API network error:', error);
      }
      return false;
    }
  }

  private async discoverV2AutopilotOptions(targetInstance: string): Promise<IV2AutopilotOptionsResponse> {
    let response: IV2AutopilotOptionsResponse;

    try {
      // Get AP supported modes and states from the specific instance
      try {
        this.discoveryInProgress.set(true);
        response = await firstValueFrom(
          this.makeHttpRequest(
            this.http.get<IV2AutopilotOptionsResponse>(
              `${API_PATHS.V2_AUTOPILOTS}/${targetInstance}`
            )
          )
        );
        console.log('[Autopilot Options] V2 Autopilot Options response:', JSON.stringify(response));
      } catch {
        response = FAILSAFE_OPTIONS_RESPONSE;
        console.log(`[Autopilot Options] Default AP discovery endpoint error for instance '${targetInstance}'`);
      }
      this.discoveryInProgress.set(false);
      return response;

    } catch (error) {
      console.error('[Autopilot Options] Failed to discover V2 endpoints:', error);
      console.log(`[Autopilot Options] Using fallback V2 endpoints for instance '${targetInstance}'`);
      return FAILSAFE_OPTIONS_RESPONSE
    }
  }

  protected onAutopilotInstanceIdChange(e: MatSelectChange): void {
    const selectedInstanceId = e.value;
    if (e.value === "") {
      this.modes.set("");
      this.autopilotFormGroup.get('modes')?.setValue("", { emitEvent: false });
      return;
    }
    console.log('[Autopilot Options] Selected Autopilot Instance ID:', selectedInstanceId);
    if (this.apiVersion() === 'v2') {
      this.discoverV2AutopilotOptions(selectedInstanceId)
        .then((instanceOptions) => {
          const apModes = instanceOptions.options.modes || [];
          this.modes.set(apModes.join(', '));
          this.autopilotFormGroup.get('modes')?.setValue(apModes, { emitEvent: false });
          console.log('[Autopilot Options] Autopilot plugin supported modes :', apModes.join(', '));
        })
        .catch(error => {
          console.error('[Autopilot Options] Error requesting autopilot modes:', error);
          this.autopilotFormGroup.get('modes')?.setValue([], { emitEvent: false });
        });
    } else if (this.apiVersion() === 'v1') {
      this.modes.set("standby, auto, wind, route");
      this.autopilotFormGroup.get('modes')?.setValue("standby, auto, wind, route", { emitEvent: false });
      console.log("[Autopilot Options] Autopilot mode set to Raymarine v1 API modes: standby, auto, wind, route");
    }
  }

  /**
   * Creates a managed HTTP request with automatic cancellation and tracking
   * @param observable The HTTP Observable to manage
   * @returns Observable with takeUntilDestroyed and tracking
   */
  private makeHttpRequest<T>(observable: Observable<T>): Observable<T> {
    const request = observable.pipe(takeUntilDestroyed(this._destroyRef));
    this.currentRequests.add(request);

    return request.pipe(
      finalize(() => this.currentRequests.delete(request))
    );
  }
}
