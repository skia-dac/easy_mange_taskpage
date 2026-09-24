// Remplace expo-widgets dans les tests (module natif iOS, absent de Node).
export type WidgetEnvironment<T = undefined> = {
  widgetFamily: string;
  colorScheme?: 'light' | 'dark';
  date: Date;
  configuration: T;
};
export function createWidget<P extends object>(
  name: string,
  layout: (props: P, env: WidgetEnvironment) => unknown,
) {
  return {
    name,
    layout,
    updateTimeline: jest.fn(),
    updateSnapshot: jest.fn(),
    reload: jest.fn(),
    getTimeline: async () => [],
  };
}
