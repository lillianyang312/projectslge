/**
 * Jest setup file - runs BEFORE jest-expo setup
 * This ensures mocks are in place before jest-expo tries to use them
 */
// The manual mock in __mocks__/react-native/Libraries/BatchedBridge/NativeModules.js
// will be automatically used by Jest before jest-expo loads NativeModules
