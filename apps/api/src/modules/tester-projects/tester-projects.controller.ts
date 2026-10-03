import {
  Body,
  Controller,
  createParamDecorator,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  type ExecutionContext,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  TesterApplicationInputSchema,
  TesterApplicationStatusInputSchema,
  TesterFeedbackInputSchema,
  TesterIdSchema,
  TesterProjectInputSchema,
  TesterProjectsQuerySchema,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type TesterActivityData,
  type TesterApplicationInput,
  type TesterApplicationStatusInput,
  type TesterApplicationsData,
  type TesterFeedbackInput,
  type TesterProjectDetailData,
  type TesterProjectInput,
  type TesterProjectsData,
  type TesterProjectsQuery,
} from '@repo/api-contracts';
import type { Response } from 'express';
import {
  OPTIONAL_ACCOUNT,
  REQUIRE_ACCOUNT,
  TesterAuthGuard,
} from '../auth/auth.guard.js';
import type { TesterRequest } from '../auth/auth-http.js';
import { TesterValidationPipe } from '../testers/testers-validation.pipe.js';
import type { TesterOutcome } from '../testers/testers.service.js';
import {
  TesterProjectsService,
  type TesterAccountIdentity,
} from './tester-projects.service.js';

const ProjectAccount = createParamDecorator(
  (
    optional: boolean | undefined,
    context: ExecutionContext,
  ): TesterAccountIdentity | null => {
    const request = context.switchToHttp().getRequest<TesterRequest>();
    if (request.testerAccountId && request.testerOwnerHash)
      return {
        id: request.testerAccountId,
        ownerHash: request.testerOwnerHash,
      };
    if (optional) return null;
    throw new UnauthorizedException();
  },
);

function respond<T>(
  response: Response,
  outcome: TesterOutcome<T>,
): ApiSuccessResponse<T> | ApiErrorResponse {
  response.status(outcome.status);
  response.setHeader('Cache-Control', 'no-store');
  return outcome.body;
}

@Controller('testers')
@UseGuards(TesterAuthGuard)
@SetMetadata(REQUIRE_ACCOUNT, true)
export class TesterProjectsController {
  constructor(
    @Inject(TesterProjectsService)
    private readonly service: TesterProjectsService,
  ) {}

  @Get('projects')
  @SetMetadata(OPTIONAL_ACCOUNT, true)
  async list(
    @Query(new TesterValidationPipe(TesterProjectsQuerySchema))
    query: TesterProjectsQuery,
    @ProjectAccount(true) account: TesterAccountIdentity | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectsData> | ApiErrorResponse> {
    return respond(response, await this.service.list(query, account));
  }

  @Get('projects/:id')
  @SetMetadata(OPTIONAL_ACCOUNT, true)
  async detail(
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @ProjectAccount(true) account: TesterAccountIdentity | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectDetailData> | ApiErrorResponse> {
    return respond(response, await this.service.detail(id, account));
  }

  @Post('projects')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async create(
    @Body(new TesterValidationPipe(TesterProjectInputSchema))
    input: TesterProjectInput,
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectDetailData> | ApiErrorResponse> {
    return respond(response, await this.service.create(input, account));
  }

  @Put('projects/:id')
  async update(
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @Body(new TesterValidationPipe(TesterProjectInputSchema))
    input: TesterProjectInput,
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectDetailData> | ApiErrorResponse> {
    return respond(response, await this.service.update(id, input, account));
  }

  @Get('projects/:id/applications')
  async applications(
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterApplicationsData> | ApiErrorResponse> {
    return respond(response, await this.service.applicants(id, account));
  }

  @Put('projects/:id/applications/me')
  async apply(
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @Body(new TesterValidationPipe(TesterApplicationInputSchema))
    input: TesterApplicationInput,
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectDetailData> | ApiErrorResponse> {
    return respond(response, await this.service.apply(id, input, account));
  }

  @Delete('projects/:id/applications/me')
  async withdraw(
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectDetailData> | ApiErrorResponse> {
    return respond(response, await this.service.withdraw(id, account));
  }

  @Patch('projects/:id/applications/:applicationId')
  async decide(
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @Param('applicationId', new TesterValidationPipe(TesterIdSchema))
    applicationId: string,
    @Body(new TesterValidationPipe(TesterApplicationStatusInputSchema))
    input: TesterApplicationStatusInput,
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectDetailData> | ApiErrorResponse> {
    return respond(
      response,
      await this.service.decide(id, applicationId, input, account),
    );
  }

  @Put('projects/:id/feedback/me')
  async feedback(
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @Body(new TesterValidationPipe(TesterFeedbackInputSchema))
    input: TesterFeedbackInput,
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterProjectDetailData> | ApiErrorResponse> {
    return respond(response, await this.service.feedback(id, input, account));
  }

  @Get('activity')
  async activity(
    @ProjectAccount() account: TesterAccountIdentity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterActivityData> | ApiErrorResponse> {
    return respond(response, await this.service.activity(account));
  }
}
