// Global types for franchise communications platform
// This file validates TypeScript configuration

export type UserRole = 'tenant_admin' | 'tenant_staff' | 'franchise_owner' | 'franchise_staff';

export type PostType = 'message' | 'announcement' | 'request' | 'performance_update';

export type TargetingType = 'global' | 'locations';

// Test strict mode with exact optional properties
export interface StrictConfigTest {
  readonly required: string;
  readonly optional?: string; // exactOptionalPropertyTypes will enforce this
}

// Test noUncheckedIndexedAccess
export function testArrayAccess(items: string[]): string | undefined {
  return items[0]; // Returns string | undefined due to noUncheckedIndexedAccess
}

// Test noImplicitReturns
export function testReturns(condition: boolean): string {
  if (condition) {
    return 'true';
  }
  return 'false'; // Required due to noImplicitReturns
}
