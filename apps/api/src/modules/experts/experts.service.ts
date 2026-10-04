import { Inject, Injectable } from '@nestjs/common';
import type { ExpertGrantRequest, ExpertListData } from '@repo/api-contracts';
import { DomainError } from '../../shared/errors/domain.error.js';
import { expertOf } from '../auth/auth.service.js';
import { ExpertsRepository } from './experts.repository.js';

@Injectable()
export class ExpertsService {
  constructor(
    @Inject(ExpertsRepository) private readonly repository: ExpertsRepository,
  ) {}

  async list(): Promise<ExpertListData> {
    const accounts = await this.repository.list();
    return {
      experts: accounts.flatMap((account) => {
        const expert = expertOf(account);
        return expert
          ? [{ id: account.id, login: account.login, ...expert }]
          : [];
      }),
    };
  }

  async grant(input: ExpertGrantRequest): Promise<ExpertListData> {
    if (!(await this.repository.grant(input.login, input.name, input.areas))) {
      throw DomainError.notFound(
        'Nie ma konta o takim loginie. Ekspert musi najpierw założyć konto.',
      );
    }
    return this.list();
  }

  async revoke(id: string): Promise<ExpertListData> {
    await this.repository.revoke(id);
    return this.list();
  }
}
