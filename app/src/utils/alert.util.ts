import { Alert, Platform } from 'react-native';

export interface ConfirmActionOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Cross-platform confirmation dialog.
 * Uses `window.confirm` on web/PWA and `Alert.alert` on native (iOS/Android).
 */
export function confirmAction({
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmActionOptions): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const confirmed =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(text)
        : true;

    if (confirmed) {
      try {
        const result = onConfirm();
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error('[confirmAction] Error in onConfirm promise:', err);
          });
        }
      } catch (err) {
        console.error('[confirmAction] Error in onConfirm:', err);
      }
    } else {
      onCancel?.();
    }
    return;
  }

  Alert.alert(title, message, [
    {
      text: cancelText,
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: confirmText,
      style: isDestructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

/**
 * Cross-platform alert dialog for simple informational/error messages.
 * Uses `window.alert` on web/PWA and `Alert.alert` on native (iOS/Android).
 */
export function showAlert(
  title: string,
  message?: string,
  onPress?: () => void,
  buttonText = 'حسناً'
): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    }
    onPress?.();
    return;
  }

  Alert.alert(title, message, [
    {
      text: buttonText,
      onPress,
    },
  ]);
}
