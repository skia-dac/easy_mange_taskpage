// Remplace expo-widgets dans les tests (module natif iOS, absent de Node).
export type WidgetEnvironment<T = undefined> = {
  widgetFamily: string;
  colorScheme?: 'light' | 'dark';
  date: Date;
  configuration: T;
};
export type LiveActivityEnvironment = {
  colorScheme?: 'light' | 'dark';
  isLuminanceReduced?: boolean;
};
export function createWidget<P extends object, C extends object | undefined = undefined>(
  name: string,
  layout: (props: P, env: WidgetEnvironment<C>) => unknown,
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
export function createLiveActivity<P extends object>(
  name: string,
  layout: (props: P, env: LiveActivityEnvironment) => unknown,
) {
  return {
    name,
    layout,
    start: jest.fn(() => ({
      update: jest.fn(async () => undefined),
      end: jest.fn(async () => undefined),
    })),
    getInstances: jest.fn(() => []),
  };
}
