/**
 * Chargement tolérant de react-native-android-widget.
 * Expo Go n'embarque pas ce module natif : un import direct lève dès le démarrage
 * (TurboModuleRegistry.getEnforcing). Dans ce cas les widgets sont ignorés et
 * le reste de l'app reste utilisable. Un development build les réactive.
 */

type AndroidWidgetPackage = typeof import('react-native-android-widget');

function loadAndroidWidgetPackage(): AndroidWidgetPackage | null {
  try {
    // Un import statique ne peut pas être attrapé : Expo Go lève pendant l'évaluation du module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-android-widget') as AndroidWidgetPackage;
  } catch {
    return null;
  }
}

export const androidWidgetPackage = loadAndroidWidgetPackage();

const MissingWidget = () => null;

export const FlexWidget: AndroidWidgetPackage['FlexWidget'] =
  androidWidgetPackage?.FlexWidget ??
  (MissingWidget as unknown as AndroidWidgetPackage['FlexWidget']);

export const TextWidget: AndroidWidgetPackage['TextWidget'] =
  androidWidgetPackage?.TextWidget ??
  (MissingWidget as unknown as AndroidWidgetPackage['TextWidget']);

export function requestWidgetUpdate(
  ...args: Parameters<AndroidWidgetPackage['requestWidgetUpdate']>
): ReturnType<AndroidWidgetPackage['requestWidgetUpdate']> {
  if (!androidWidgetPackage) return Promise.resolve();
  return androidWidgetPackage.requestWidgetUpdate(...args);
}

export function registerAndroidWidgetHandlers(
  handler: Parameters<AndroidWidgetPackage['registerWidgetTaskHandler']>[0],
  screen: Parameters<AndroidWidgetPackage['registerWidgetConfigurationScreen']>[0],
): void {
  if (!androidWidgetPackage) return;
  androidWidgetPackage.registerWidgetTaskHandler(handler);
  androidWidgetPackage.registerWidgetConfigurationScreen(screen);
}
