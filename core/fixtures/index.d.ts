import { TestType, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions } from '@playwright/test';
import { BasePage } from '../../pages/BasePage';

export interface WorkerUserData {
  user: Record<string, any>;
  filePath: string;
}

export interface AuthenticatedUser {
  [key: string]: any;
  runtimeDataPath: string;
}

export interface CleanupRegistry {
  register(taskFn: () => Promise<void> | void, metadata?: { label?: string; resourceId?: string; timeoutMs?: number }): void;
  runAll(): Promise<Error[]>;
  size(): number;
}

/**
 * Lazy-loaded Pages Container Proxy
 * Cung cấp cơ chế khởi tạo và cache per-test cho toàn bộ Page Objects.
 */
export interface PagesContainer {
  [pageKey: string]: any;
  sample?: any;
  samplePage?: any;
  SamplePage?: any;
  sampleMobile?: any;
  sampleMobilePage?: any;
  SampleMobilePage?: any;
}

export interface FrameworkFixtures {
  workerUserData: WorkerUserData;
  featureName: string;
  basePage: BasePage;
  pages: PagesContainer;
  authenticatedUser: AuthenticatedUser;
  cleanupQueue: CleanupRegistry;
  pageObjectsRoot?: string;
  pageObjectsPlatform?: 'desktop' | 'mobile-web' | 'auto';
}

export const test: TestType<PlaywrightTestArgs & PlaywrightTestOptions & FrameworkFixtures, PlaywrightWorkerArgs & PlaywrightWorkerOptions>;
export { expect } from '@playwright/test';
export function resolvePlatform(options: { pageObjectsPlatform?: string; isMobile?: boolean; testInfo?: any }): string;
export const RESERVED_FIXTURE_NAMES: Set<string>;
