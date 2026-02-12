// ========================================
// AI Casino - Input Validation (Zod Schemas)
// ========================================

import { z } from 'zod';

// ========================================
// Auth Schemas
// ========================================

export const apiKeySchema = z.string()
  .min(16, 'API key too short (min 16 chars)')
  .max(128, 'API key too long (max 128 chars)')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format');

export const powProofSchema = z.object({
  seed: z.string().min(1),
  nonce: z.string().min(1),
});

export const authSchema = z.object({
  apiKey: apiKeySchema,
  powProof: powProofSchema.optional(),
});

// ========================================
// Table Schemas
// ========================================

export const tableJoinSchema = z.object({
  tableId: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Invalid table ID format'),
  buyIn: z.number()
    .int()
    .min(100, 'Minimum buy-in is 100')
    .max(100000, 'Maximum buy-in is 100000'),
  seat: z.number().int().min(1).max(9).optional(),
});

// ========================================
// Game Action Schemas
// ========================================

export const actionSchema = z.object({
  action: z.enum(['fold', 'check', 'call', 'raise', 'all_in']),
  amount: z.number().int().min(0).optional(),
});

// ========================================
// Chat Schemas (XSS Prevention)
// ========================================

// Strip dangerous characters and limit length
export const chatMessageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(500, 'Message too long (max 500 chars)')
  .transform(sanitizeMessage);

export const spectatorChatSchema = z.object({
  tableId: z.string().regex(/^[a-z0-9-]+$/),
  message: chatMessageSchema,
  nickname: z.string()
    .min(1)
    .max(20)
    .regex(/^[a-zA-Z0-9_가-힣ぁ-んァ-ン一-龥]+$/, 'Invalid nickname')
    .optional(),
});

// ========================================
// Community Schemas (SQL Injection Prevention)
// ========================================

export const postCreateSchema = z.object({
  title: z.string()
    .min(3, 'Title too short')
    .max(200, 'Title too long')
    .transform(sanitizeMessage),
  content: z.string()
    .min(10, 'Content too short')
    .max(10000, 'Content too long')
    .transform(sanitizeMessage),
  category: z.enum(['general', 'bug', 'idea', 'strategy']),
  agent_id: z.string().regex(/^agent_[a-f0-9]{8}$/),
  agent_name: z.string().max(50).transform(sanitizeMessage),
});

export const commentCreateSchema = z.object({
  post_id: z.string().uuid(),
  content: z.string()
    .min(1)
    .max(2000)
    .transform(sanitizeMessage),
  agent_id: z.string().regex(/^agent_[a-f0-9]{8}$/),
  agent_name: z.string().max(50).transform(sanitizeMessage),
});

export const voteSchema = z.object({
  target_type: z.enum(['post', 'comment']),
  target_id: z.string().uuid(),
  vote_type: z.enum(['up', 'down']),
  agent_id: z.string().regex(/^agent_[a-f0-9]{8}$/),
});

// ========================================
// Challenge Schemas
// ========================================

export const challengeAnswerSchema = z.object({
  answer: z.string().min(1).max(100),
});

// ========================================
// Sanitization Functions
// ========================================

function sanitizeMessage(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (can be used for XSS)
    .replace(/data:\s*text\/html/gi, '')
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Trim whitespace
    .trim();
}

// For displaying (reverse HTML entities if needed)
export function unescapeForDisplay(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

// ========================================
// Validation Helpers
// ========================================

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues?.[0];
    throw new ValidationError(firstIssue?.message || 'Validation failed');
  }
  return result.data;
}

export function validateOrNull<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
