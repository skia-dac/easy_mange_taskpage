// Remplace react-native-android-widget dans les tests (module natif Android).
const stub = () => null;
export const FlexWidget = stub;
export const TextWidget = stub;
export const requestWidgetUpdate = jest.fn(async () => undefined);
export const registerWidgetTaskHandler = jest.fn();
export type WidgetTaskHandlerProps = {
  widgetInfo: { widgetName: string; widgetId: number; width: number; height: number };
  widgetAction: string;
  renderWidget: (w: unknown) => void;
  clickAction?: string;
  clickActionData?: unknown;
};
