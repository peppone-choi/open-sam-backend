/**
 * Validation Middleware Tests
 * Tests for NoSQL injection prevention and input validation
 */

import {
  safeParseInt,
  safeParsePositiveInt,
  adminGeneralSchema,
  adminPenaltySchema,
  loghCommanderSchema,
  battleIdSchema,
  battleGeneralIdSchema,
  preventMongoInjection,
  validate,
} from '../src/middleware/validation.middleware';
import { Request, Response } from 'express';

describe('Validation Middleware', () => {
  describe('safeParseInt', () => {
    it('should parse valid integer strings', () => {
      expect(safeParseInt('42', 'test')).toBe(42);
      expect(safeParseInt('0', 'test')).toBe(0);
      expect(safeParseInt('-10', 'test')).toBe(-10);
    });

    it('should parse valid integer numbers', () => {
      expect(safeParseInt(42, 'test')).toBe(42);
      expect(safeParseInt(0, 'test')).toBe(0);
      expect(safeParseInt(-10, 'test')).toBe(-10);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => safeParseInt('not-a-number', 'test')).toThrow('test must be a valid number');
      expect(() => safeParseInt(NaN, 'test')).toThrow('test must be a valid number');
      expect(() => safeParseInt(Infinity, 'test')).toThrow('test must be a finite number');
      expect(() => safeParseInt({}, 'test')).toThrow('test must be a valid number');
      expect(() => safeParseInt(null, 'test')).toThrow('test must be a valid number');
    });
  });

  describe('safeParsePositiveInt', () => {
    it('should parse valid positive integers', () => {
      expect(safeParsePositiveInt('42', 'test')).toBe(42);
      expect(safeParsePositiveInt('0', 'test')).toBe(0);
      expect(safeParsePositiveInt(100, 'test')).toBe(100);
    });

    it('should throw error for negative numbers', () => {
      expect(() => safeParsePositiveInt('-10', 'test')).toThrow('test must be a positive number');
      expect(() => safeParsePositiveInt(-5, 'test')).toThrow('test must be a positive number');
    });
  });

  describe('adminGeneralSchema', () => {
    it('should validate valid general data', async () => {
      const validData = { generalID: 1001, generalNo: 5 };
      const result = await adminGeneralSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid general ID', async () => {
      await expect(
        adminGeneralSchema.validate({ generalID: -1 })
      ).rejects.toThrow();

      await expect(
        adminGeneralSchema.validate({ generalID: 'invalid' })
      ).rejects.toThrow();
    });

    it('should reject MongoDB operators', async () => {
      await expect(
        adminGeneralSchema.validate({ generalID: { $gt: 0 } })
      ).rejects.toThrow();
    });
  });

  describe('adminPenaltySchema', () => {
    it('should validate valid penalty data', async () => {
      const validData = { generalNo: 1001, penaltyLevel: 5 };
      const result = await adminPenaltySchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should reject penalty level out of range', async () => {
      await expect(
        adminPenaltySchema.validate({ generalNo: 1001, penaltyLevel: 99 })
      ).rejects.toThrow('penaltyLevel must be <= 10');

      await expect(
        adminPenaltySchema.validate({ generalNo: 1001, penaltyLevel: -1 })
      ).rejects.toThrow('penaltyLevel must be >= 0');
    });
  });

  describe('loghCommanderSchema', () => {
    it('should validate valid commander number', async () => {
      const result = await loghCommanderSchema.validate({ commanderNo: 42 });
      expect(result).toEqual({ commanderNo: 42 });
    });

    it('should reject invalid commander number', async () => {
      await expect(
        loghCommanderSchema.validate({ commanderNo: -1 })
      ).rejects.toThrow();

      await expect(
        loghCommanderSchema.validate({ commanderNo: 'invalid' })
      ).rejects.toThrow();
    });
  });

  describe('battleIdSchema', () => {
    it('should validate valid UUID', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = await battleIdSchema.validate({ battleId: uuid });
      expect(result).toEqual({ battleId: uuid });
    });

    it('should reject invalid UUID', async () => {
      await expect(
        battleIdSchema.validate({ battleId: 'not-a-uuid' })
      ).rejects.toThrow('battleId must be a valid UUID');

      await expect(
        battleIdSchema.validate({ battleId: { $ne: null } })
      ).rejects.toThrow();
    });
  });

  describe('battleGeneralIdSchema', () => {
    it('should validate valid general ID', async () => {
      const result = await battleGeneralIdSchema.validate({ generalId: 1001 });
      expect(result).toEqual({ generalId: 1001 });
    });

    it('should reject invalid general ID', async () => {
      await expect(
        battleGeneralIdSchema.validate({ generalId: -1 })
      ).rejects.toThrow();

      await expect(
        battleGeneralIdSchema.validate({ generalId: 'invalid' })
      ).rejects.toThrow();
    });
  });

  describe('preventMongoInjection middleware', () => {
    it('should allow clean objects', () => {
      const req = {
        body: {
          generalNo: 1001,
          penaltyLevel: 5,
          nested: { value: 123 },
        },
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      const middleware = preventMongoInjection('body');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject objects with $ operators', () => {
      const req = {
        body: {
          generalNo: { $gt: 0 },
        },
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      const middleware = preventMongoInjection('body');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining('dangerous key'),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject objects with dot notation', () => {
      const req = {
        body: {
          'user.name': 'injection',
        },
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      const middleware = preventMongoInjection('body');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject nested $ operators', () => {
      const req = {
        body: {
          filter: {
            value: { $ne: null },
          },
        },
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      const middleware = preventMongoInjection('body');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validate middleware', () => {
    it('should validate and pass through valid data', async () => {
      const req = {
        body: { generalNo: 1001, penaltyLevel: 5 },
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      const middleware = validate(adminPenaltySchema, 'body');
      await middleware(req, res, next);

      expect(req.body).toEqual({ generalNo: 1001, penaltyLevel: 5 });
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid data', async () => {
      const req = {
        body: { generalNo: 'invalid', penaltyLevel: 99 },
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      const middleware = validate(adminPenaltySchema, 'body');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Validation failed',
          errors: expect.any(Array),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should strip unknown fields', async () => {
      const req = {
        body: {
          generalNo: 1001,
          penaltyLevel: 5,
          unknownField: 'should be stripped',
        },
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      const middleware = validate(adminPenaltySchema, 'body');
      await middleware(req, res, next);

      expect(req.body).toEqual({ generalNo: 1001, penaltyLevel: 5 });
      expect(req.body).not.toHaveProperty('unknownField');
      expect(next).toHaveBeenCalled();
    });
  });
});
