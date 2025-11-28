import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  validateDialogText,
  validateNodeId,
  validateTag,
  validateProjectType,
  validateApiResponse,
  validateConnection,
  validateNumber,
} from '../validation';

type BasicTagShape = { id: string; label: string; metadata?: { importance?: number } };

describe('validation utilities', () => {
  describe('sanitizeInput', () => {
    it('should sanitize dangerous HTML', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(maliciousInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('alert'); // alert is escaped but still visible
      expect(sanitized).toContain('&lt;'); // HTML is properly escaped
    });

    it('should escape HTML entities', () => {
      const input = '<div>Hello & "World"</div>';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe('&lt;div&gt;Hello &amp; &quot;World&quot;&lt;&#x2F;div&gt;');
    });

    it('should handle empty input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });
  });

  describe('validateDialogText', () => {
    it('should validate normal text', () => {
      const result = validateDialogText('Hello world!');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty text', () => {
      const result = validateDialogText('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Text is required');
    });

    it('should enforce max length', () => {
      const longText = 'a'.repeat(100);
      const result = validateDialogText(longText, 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
      expect(result.sanitized).toHaveLength(50);
    });
  });

  describe('validateNodeId', () => {
    it('should validate correct node ID format', () => {
      expect(validateNodeId('npcDialog_abc123')).toBe(true);
      expect(validateNodeId('playerResponse_xyz789')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateNodeId('')).toBe(false);
      expect(validateNodeId('invalid')).toBe(false);
      expect(validateNodeId('123_abc')).toBe(false);
      expect(validateNodeId('node-abc')).toBe(false);
    });
  });

  describe('validateTag', () => {
    it('should validate correct tag', () => {
      const tag = {
        id: 'tag1',
        label: 'Character',
        content: 'A brave warrior',
        metadata: { importance: 3 }
      };
      const result = validateTag(tag);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject tag without required fields', () => {
      const tag: Partial<BasicTagShape> = {};
      const result = validateTag(tag);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tag ID is required');
      expect(result.errors).toContain('Tag label is required');
    });

    it('should validate importance range', () => {
      const tag = {
        id: 'tag1',
        label: 'Test',
        metadata: { importance: 10 }
      };
      const result = validateTag(tag);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tag importance must be between 1 and 5');
    });
  });

  describe('validateProjectType', () => {
    it('should validate correct project types', () => {
      expect(validateProjectType('game')).toBe(true);
      expect(validateProjectType('interactive_story')).toBe(true);
      expect(validateProjectType('novel')).toBe(true);
    });

    it('should reject invalid project types', () => {
      expect(validateProjectType('invalid')).toBe(false);
      expect(validateProjectType('')).toBe(false);
    });
  });

  describe('validateApiResponse', () => {
    it('should validate good response', () => {
      const response = { data: 'success', status: 'ok' };
      const result = validateApiResponse(response);
      expect(result.isValid).toBe(true);
    });

    it('should reject error responses', () => {
      const response = { error: 'Something went wrong' };
      const result = validateApiResponse(response);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('should handle empty responses', () => {
      const result = validateApiResponse(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Empty response');
    });
  });

  describe('validateConnection', () => {
    it('should validate correct connection', () => {
      const conn = { source: 'node1', target: 'node2' };
      expect(validateConnection(conn)).toBe(true);
    });

    it('should reject self-connections', () => {
      const conn = { source: 'node1', target: 'node1' };
      expect(validateConnection(conn)).toBe(false);
    });

    it('should reject invalid connections', () => {
      expect(validateConnection({})).toBe(false);
      expect(validateConnection({ source: 'node1' })).toBe(false);
      expect(validateConnection(null)).toBe(false);
    });
  });

  describe('validateNumber', () => {
    it('should validate numbers within range', () => {
      const result = validateNumber('42', 1, 100);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should reject invalid numbers', () => {
      const result = validateNumber('not a number');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid number');
    });

    it('should enforce min/max bounds', () => {
      const minResult = validateNumber('0', 1, 100);
      expect(minResult.isValid).toBe(false);
      expect(minResult.value).toBe(1);

      const maxResult = validateNumber('200', 1, 100);
      expect(maxResult.isValid).toBe(false);
      expect(maxResult.value).toBe(100);
    });
  });
});