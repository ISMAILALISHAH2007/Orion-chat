/** Shared install instructions used by InstallPrompt and Sidebar */

export const INSTALL_INSTRUCTIONS = {
  android:
    '📱 To install ORION on your Android device:\n\n' +
    '1. Tap the ⋮ (three dots) menu in your browser\n' +
    '2. Select "Install app" or "Add to Home screen"\n' +
    '3. Follow the on-screen instructions\n\n' +
    'This installs the Progressive Web App (PWA) — no APK file needed!',

  default:
    '📱 To install ORION:\n\n' +
    '• On iPhone/iPad: Tap the Share icon (📤) → "Add to Home Screen"\n' +
    '• On Android: Tap the browser menu (⋮) → "Install App" or "Add to Home Screen"\n' +
    '• On Desktop: Look for the install icon (➕) in the address bar',
};

export function showInstallInstructions(isAndroid: boolean) {
  alert(isAndroid ? INSTALL_INSTRUCTIONS.android : INSTALL_INSTRUCTIONS.default);
}
