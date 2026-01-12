/**
 * Mock for expo-modules-core/build/Refs
 * This is required by jest-expo
 */

module.exports = {
  createSnapshotFriendlyRef: () => {
    const ref = { current: null };
    Object.defineProperty(ref, 'toJSON', {
      value: () => '[React.ref]',
    });
    return ref;
  },
};

