import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const native = Capacitor.isNativePlatform();

export function tapHaptic() {
  if (native) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  else if ('vibrate' in navigator) navigator.vibrate?.(8);
}

export function successHaptic() {
  if (native) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  else if ('vibrate' in navigator) navigator.vibrate?.([10, 40, 10]);
}
