// Remplace react-native-android-widget dans les tests (module natif Android).
const stub = () => null;
export const FlexWidget = stub;
export const TextWidget = stub;
export const requestWidgetUpdate = jest.fn(async () => undefined);
export const requestWidgetUpdateById = jest.fn(async () => undefined);
export const registerWidgetTaskHandler = jest.fn();
export const registerWidgetConfigurationScreen = jest.fn();
export type WidgetInfo = { widgetName: string; widgetId: number; width: number; height: number };
export type WidgetTaskHandlerProps = {
  widgetInfo: WidgetInfo;
  widgetAction: string;
  renderWidget: (w: unknown) => void;
  clickAction?: string;
  clickActionData?: unknown;
};
export type WidgetConfigurationScreenProps = {
  widgetInfo: WidgetInfo;
  renderWidget: (w: unknown) => void;
  setResult: (r: 'ok' | 'cancel') => void;
};
