// Point d'entrée de l'app : Expo Router, plus l'enregistrement de la tâche de fond des widgets Android.
import 'expo-router/entry';

import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from '@/modules/platform';

registerWidgetTaskHandler(widgetTaskHandler);
