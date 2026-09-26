// Point d'entrée de l'app : Expo Router, l'enregistrement de la tâche de fond des widgets Android
// et la définition (hors composant) de la tâche de fond qui reprogramme les rappels.
import 'expo-router/entry';

import {
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
} from 'react-native-android-widget';

import {
  defineNotificationsTask,
  SubjectConfigScreen,
  widgetTaskHandler,
} from '@/modules/platform';

registerWidgetTaskHandler(widgetTaskHandler);
defineNotificationsTask();
registerWidgetConfigurationScreen(SubjectConfigScreen);
