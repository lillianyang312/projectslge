/**
 * Jest setup file - runs AFTER jest-expo setup
 */

// Setup testing library matchers
require('@testing-library/jest-native/extend-expect');

// Suppress console warnings in tests
const originalError = console.error;
const originalWarn = console.warn;
global.console = {
  ...console,
  warn: jest.fn((...args) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('VirtualizedLists')) {
      return;
    }
    originalWarn(...args);
  }),
  error: (...args) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('Warning: ReactDOM.render') ||
        message.includes('Warning: React.createFactory') ||
        message.includes('VirtualizedLists'))
    ) {
      return;
    }
    originalError(...args);
  },
};

