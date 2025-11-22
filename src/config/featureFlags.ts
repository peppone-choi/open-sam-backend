export const FeatureFlags = {
  isRootDBEnabled(): boolean {
    return process.env.ROOTDB_ENABLED === 'true';
  },
};
