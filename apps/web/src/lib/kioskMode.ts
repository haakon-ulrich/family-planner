// True only when running as the on-device kiosk (production build, accessed from localhost).
// Used to enable cursor hiding and the virtual keyboard.
export const isKioskMode = import.meta.env.PROD && window.location.hostname === 'localhost';
