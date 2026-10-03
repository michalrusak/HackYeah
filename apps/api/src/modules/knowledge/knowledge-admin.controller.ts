import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AdminLoginSchema,
  createApiSuccess,
  ErrorCodes,
  KnowledgeImportSchema,
  KnowledgeInputSchema,
  KnowledgeQuerySchema,
  KnowledgeUpdateSchema,
  type KnowledgeInput,
  type KnowledgeQuery,
} from '@repo/api-contracts';
import type { Request, Response } from 'express';
import { KnowledgeAuthService } from './knowledge-auth.service.js';
import {
  KnowledgeAdminGuard,
  type KnowledgeAdminRequest,
} from './knowledge-admin.guard.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeValidationPipe } from './knowledge-validation.pipe.js';

@Controller('knowledge/admin')
export class KnowledgeAdminController {
  constructor(
    @Inject(KnowledgeService) private readonly service: KnowledgeService,
    @Inject(KnowledgeAuthService) private readonly auth: KnowledgeAuthService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async login(
    @Body(new KnowledgeValidationPipe(AdminLoginSchema))
    body: { password: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.auth.checkOrigin(request);
    response.setHeader('Cache-Control', 'no-store');
    return createApiSuccess(await this.auth.login(body.password, response));
  }

  @Get('session')
  @UseGuards(KnowledgeAdminGuard)
  session(
    @Req() request: KnowledgeAdminRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return createApiSuccess(request.knowledgeSession);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(KnowledgeAdminGuard)
  async logout(
    @Req() request: KnowledgeAdminRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.knowledgeSessionId, response);
    return createApiSuccess({ accepted: true });
  }

  @Get('resources')
  @UseGuards(KnowledgeAdminGuard)
  async list(
    @Query(new KnowledgeValidationPipe(KnowledgeQuerySchema))
    query: KnowledgeQuery,
  ) {
    return createApiSuccess(await this.service.list(query, true));
  }

  @Get('summary')
  @UseGuards(KnowledgeAdminGuard)
  async summary(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return createApiSuccess(await this.service.summary());
  }

  @Post('resources')
  @UseGuards(KnowledgeAdminGuard)
  async create(
    @Body(new KnowledgeValidationPipe(KnowledgeInputSchema))
    input: KnowledgeInput,
  ) {
    return createApiSuccess(await this.service.create(input));
  }

  @Put('resources/:id')
  @UseGuards(KnowledgeAdminGuard)
  async update(
    @Param('id') id: string,
    @Body(new KnowledgeValidationPipe(KnowledgeUpdateSchema))
    body: { resource: KnowledgeInput; revision: number },
  ) {
    if (id !== body.resource.id)
      throw new BadRequestException({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Identyfikator zasobu nie zgadza się z adresem.',
        },
      });
    return createApiSuccess(
      await this.service.update(body.resource, body.revision),
    );
  }

  @Post('import')
  @UseGuards(KnowledgeAdminGuard)
  async import(
    @Body(new KnowledgeValidationPipe(KnowledgeImportSchema))
    body: {
      resources: KnowledgeInput[];
    },
  ) {
    return createApiSuccess({
      imported: await this.service.importDrafts(body.resources),
    });
  }

  @Get('trends')
  @UseGuards(KnowledgeAdminGuard)
  async trends(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return createApiSuccess(await this.service.trends());
  }
}
