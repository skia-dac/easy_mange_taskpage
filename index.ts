// Point d'entrée de l'app : Expo Router, plus l'enregistrement de la tâche de fond des widgets Android.
// L'enregistrement est ignoré dans Expo Go (module natif absent) : voir widgetNative.ts.
import 'expo-router/entry';

import { SubjectConfigScreen, widgetTaskHandler } from '@/modules/platform';
import { registerAndroidWidgetHandlers } from '@/modules/platform/widgets/android/widgetNative';

registerAndroidWidgetHandlers(widgetTaskHandler, SubjectConfigScreen);
