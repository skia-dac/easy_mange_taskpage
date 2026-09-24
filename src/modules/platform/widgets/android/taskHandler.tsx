import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { readWidgetSnapshot } from '../snapshot';
import { ANDROID_WIDGETS, renderAndroidWidget, type AndroidWidgetName } from './widgets';

/**
 * Appelé par Android (en tâche de fond) quand un widget est ajouté, redimensionné ou doit être
 * rafraîchi. Il n'ouvre pas la base : il relit la dernière photo écrite par l'app.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const name = props.widgetInfo.widgetName as AndroidWidgetName;
  if (!ANDROID_WIDGETS.includes(name)) return;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = readWidgetSnapshot();
      if (data) props.renderWidget(renderAndroidWidget(name, data));
      break;
    }
    default:
      break;
  }
}
