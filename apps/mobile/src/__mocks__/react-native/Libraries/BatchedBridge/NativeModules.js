/**
 * Manual mock for React Native NativeModules
 * This ensures UIManager exists before jest-expo tries to modify it
 */

const mockUIManager = {
  getViewManagerConfig: jest.fn(),
  hasViewManagerConfig: jest.fn(),
  createView: jest.fn(),
  updateView: jest.fn(),
  manageChildren: jest.fn(),
  setChildren: jest.fn(),
  measure: jest.fn(),
  measureInWindow: jest.fn(),
  measureLayout: jest.fn(),
  findSubviewIn: jest.fn(),
  dispatchViewManagerCommand: jest.fn(),
  sendAccessibilityEvent: jest.fn(),
  configureNextLayoutAnimation: jest.fn(),
  viewIsDescendantOf: jest.fn(),
};

const NativeModules = {
  UIManager: mockUIManager,
  NativeUnimoduleProxy: {
    viewManagersMetadata: {},
  },
  Linking: {
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    openURL: jest.fn(() => Promise.resolve()),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
  },
};

module.exports = NativeModules;

