import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { readCurrentWidgetData, readWidgetConfig, removeWidgetConfig } from '../snapshot';
import { ANDROID_WIDGETS, renderAndroidWidget, type AndroidWidgetName } from './widgets';

/**
 * Appelé par Android (en tâche de fond) quand un widget est ajouté, redimensionné ou doit être
 * rafraîchi. Il n'ouvre pas la base : il relit la chronologie écrite par l'app et affiche
 * l'entrée correspondant à l'heure courante (le « prochain cours » avance sans l'app).
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const name = props.widgetInfo.widgetName as AndroidWidgetName;
  if (!ANDROID_WIDGETS.includes(name)) return;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = readCurrentWidgetData();
      if (!data) break;
      const subjectId = readWidgetConfig()[String(props.widgetInfo.widgetId)]?.subjectId ?? null;
      props.renderWidget(renderAndroidWidget(name, data, { subjectId }));
      break;
    }
    case 'WIDGET_DELETED':
      removeWidgetConfig(props.widgetInfo.widgetId);
      break;
    default:
      break;
  }
}
