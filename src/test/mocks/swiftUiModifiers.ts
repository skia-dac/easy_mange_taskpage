// Remplace @expo/ui/swift-ui/modifiers dans les tests.
const mod = (...args: unknown[]) => ({ $type: 'modifier', args });
export const background = mod;
export const containerBackground = mod;
export const font = mod;
export const foregroundStyle = mod;
export const frame = mod;
export const lineLimit = mod;
export const padding = mod;
export const strikethrough = mod;
export const widgetURL = mod;
export const shapes = { roundedRectangle: mod, capsule: mod, circle: mod, rectangle: mod };
