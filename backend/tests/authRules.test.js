import { describe, test, expect } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateSixDigitCode } from '../src/controllers/authController.js';
import { authorizeRoles } from '../src/middleware/authMiddleware.js';

describe('4. Magic Code Authentication & Security Tests', () => {
  test('generates valid 6-digit numeric codes', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateSixDigitCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThan(1000000);
    }
  });

  test('hashes codes with bcrypt securely and verifies match', async () => {
    const code = '492815';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(code, salt);

    expect(await bcrypt.compare(code, hash)).toBe(true);
    expect(await bcrypt.compare('111111', hash)).toBe(false);
  });

  test('RBAC middleware permits authorized roles and blocks unauthorized roles', () => {
    const managerGuard = authorizeRoles('BRANCH_MANAGER', 'ADMIN');

    // Case 1: Branch Staff attempting manager endpoint -> 403 Forbidden
    const mockReqStaff = { user: { role: 'BRANCH_STAFF' } };
    let statusSet = null;
    let jsonOutput = null;
    const mockRes = {
      status: (code) => {
        statusSet = code;
        return {
          json: (data) => { jsonOutput = data; },
        };
      },
    };
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    managerGuard(mockReqStaff, mockRes, mockNext);
    expect(statusSet).toBe(403);
    expect(jsonOutput.error).toBe('Forbidden');
    expect(nextCalled).toBe(false);

    // Case 2: Branch Manager accessing manager endpoint -> Allowed
    const mockReqManager = { user: { role: 'BRANCH_MANAGER' } };
    nextCalled = false;
    managerGuard(mockReqManager, mockRes, mockNext);
    expect(nextCalled).toBe(true);
  });
});