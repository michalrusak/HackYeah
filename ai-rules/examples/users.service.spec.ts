// apps/api-nest/src/modules/users/users.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { ErrorCode } from '@repo/api-contracts';

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
    };
    service = new UsersService(repo as unknown as UsersRepository);
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      repo.findById.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Alice',
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.findById('u1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('a@b.com');
      }
    });

    it('returns USER_NOT_FOUND when missing', async () => {
      repo.findById.mockResolvedValue(null);

      const result = await service.findById('missing');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.USER_NOT_FOUND);
      }
    });
  });

  describe('create', () => {
    it('returns EMAIL_TAKEN when email exists', async () => {
      repo.findByEmail.mockResolvedValue({ id: 'existing' });

      const result = await service.create({ email: 'dup@b.com', name: 'Bob' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.EMAIL_TAKEN);
      }
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates user when email is free', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.create.mockResolvedValue({
        id: 'new-id',
        email: 'new@b.com',
        name: 'Carol',
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.create({ email: 'new@b.com', name: 'Carol' });

      expect(result.success).toBe(true);
      expect(repo.create).toHaveBeenCalledWith({ email: 'new@b.com', name: 'Carol' });
    });
  });
});
