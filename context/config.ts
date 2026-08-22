// Centralized API Configuration
// Supports Web (localhost), Mobile/Emulator (LAN IP), and Cloud (env var)
const getApiUrl = (): string => {
  // 1. Use explicit env variable if set (production / staging deployments)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // 2. Detect web environment without importing Platform (avoids SSR "Platform is not defined" errors)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'http://localhost:8000';
  }
  // 3. Mobile / Expo Go — use your machine's LAN IP
  return 'http://10.0.28.67:8000';
};

export const API_URL = getApiUrl();
