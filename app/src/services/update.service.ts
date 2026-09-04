import * as Updates from 'expo-updates';
import { AppState, AppStateStatus } from 'react-native';

export class UpdateService {
  private static isChecking = false;

  /**
   * Check and apply OTA updates silently.
   * Safe to call anywhere: no-ops in development mode or web.
   */
  static async checkAndApplyUpdate(isForegroundEvent = false): Promise<boolean> {
    if (__DEV__) return false;
    if (UpdateService.isChecking) return false;

    UpdateService.isChecking = true;
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        await Updates.fetchUpdateAsync();
        // If it's a cold launch or foreground return, reload immediately into the new bundle
        await Updates.reloadAsync();
        return true;
      }
    } catch (err) {
      // Offline, network timeout, or server unreachable — fail silently without blocking the user
      if (!isForegroundEvent) {
        console.log('[UpdateService] Update check skipped or network unavailable');
      }
    } finally {
      UpdateService.isChecking = false;
    }

    return false;
  }

  /**
   * Listen for app coming to the foreground to check for updates in the background.
   */
  static initForegroundUpdateListener(): () => void {
    if (__DEV__) return () => {};

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        UpdateService.checkAndApplyUpdate(true).catch(() => {});
      }
    });

    return () => subscription.remove();
  }
}
