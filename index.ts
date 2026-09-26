// Point d'entrée de l'app : Expo Router, l'enregistrement de la tâche de fond des widgets Android
// (ignoré dans Expo Go, module natif absent : voir widgetNative.ts) et la définition (hors composant)
// de la tâche de fond qui reprogramme les rappels.
import 'expo-router/entry';

import {
  defineNotificationsTask,
  SubjectConfigScreen,
  widgetTaskHandler,
} from '@/modules/platform';
import { registerAndroidWidgetHandlers } from '@/modules/platform/widgets/android/widgetNative';

registerAndroidWidgetHandlers(widgetTaskHandler, SubjectConfigScreen);
defineNotificationsTask();
