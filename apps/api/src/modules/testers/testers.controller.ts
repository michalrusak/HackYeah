import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  TesterAssignmentInputSchema, TesterIdSchema, TesterProfileInputSchema, TesterSearchRequestSchema,
  type ApiErrorResponse, type ApiSuccessResponse, type MyTesterProfileData, type TesterAssignmentInput,
  type TesterProfileInput, type TesterProfilesData, type TesterSearchData, type TesterSearchRequest,
  type TesterSearchesData,
} from '@repo/api-contracts';
import type { Response } from 'express';
import { TesterOwner, TesterValidationPipe } from './testers-validation.pipe.js';
import { TestersService, type TesterOutcome } from './testers.service.js';

function respond<T>(response: Response, outcome: TesterOutcome<T>): ApiSuccessResponse<T> | ApiErrorResponse {
  response.status(outcome.status);
  return outcome.body;
}

@Controller('testers')
export class TestersController {
  constructor(@Inject(TestersService) private readonly service: TestersService) {}

  @Get('profiles')
  async profiles(@Res({ passthrough: true }) response: Response): Promise<ApiSuccessResponse<TesterProfilesData> | ApiErrorResponse> {
    return respond(response, await this.service.profiles());
  }

  @Get('profile/me')
  async ownProfile(
    @TesterOwner() ownerHash: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<MyTesterProfileData> | ApiErrorResponse> {
    return respond(response, await this.service.ownProfile(ownerHash));
  }

  @Put('profile/me')
  async saveProfile(
    @TesterOwner() ownerHash: string,
    @Body(new TesterValidationPipe(TesterProfileInputSchema)) input: TesterProfileInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<MyTesterProfileData> | ApiErrorResponse> {
    return respond(response, await this.service.saveProfile(ownerHash, input));
  }

  @Post('search')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async search(
    @TesterOwner() ownerHash: string,
    @Body(new TesterValidationPipe(TesterSearchRequestSchema)) input: TesterSearchRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterSearchData> | ApiErrorResponse> {
    return respond(response, await this.service.search(ownerHash, input.query));
  }

  @Get('searches')
  async history(
    @TesterOwner() ownerHash: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterSearchesData> | ApiErrorResponse> {
    return respond(response, await this.service.history(ownerHash));
  }

  @Get('searches/:id')
  async getSearch(
    @TesterOwner() ownerHash: string,
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterSearchData> | ApiErrorResponse> {
    return respond(response, await this.service.getSearch(ownerHash, id));
  }

  @Post('searches/:id/assignments')
  async assign(
    @TesterOwner() ownerHash: string,
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @Body(new TesterValidationPipe(TesterAssignmentInputSchema)) input: TesterAssignmentInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterSearchData> | ApiErrorResponse> {
    return respond(response, await this.service.assign(ownerHash, id, input.profileId));
  }

  @Delete('searches/:id/assignments/:profileId')
  async unassign(
    @TesterOwner() ownerHash: string,
    @Param('id', new TesterValidationPipe(TesterIdSchema)) id: string,
    @Param('profileId', new TesterValidationPipe(TesterIdSchema)) profileId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<TesterSearchData> | ApiErrorResponse> {
    return respond(response, await this.service.unassign(ownerHash, id, profileId));
  }
}
