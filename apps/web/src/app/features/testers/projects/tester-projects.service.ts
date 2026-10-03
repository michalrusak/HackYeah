import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import {
  TesterProjectsDataSchema,
  TesterProjectDetailDataSchema,
  TesterApplicationsDataSchema,
  TesterActivityDataSchema,
  TesterProjectInputSchema,
  TesterApplicationInputSchema,
  TesterApplicationStatusInputSchema,
  TesterFeedbackInputSchema,
  type TesterProjectsData,
  type TesterProjectDetailData,
  type TesterApplicationsData,
  type TesterActivityData,
  type TesterProjectInput,
  type TesterFeedbackInput,
} from '@repo/api-contracts';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class TesterProjectsService {
  private readonly api = inject(ApiService);
  list(page = 1): Observable<TesterProjectsData> {
    return this.api
      .request(
        'GET',
        `/testers/projects?page=${page}`,
        TesterProjectsDataSchema,
        { withCredentials: true },
      )
      .pipe(timeout(20000));
  }
  detail(id: string): Observable<TesterProjectDetailData> {
    return this.api
      .request(
        'GET',
        `/testers/projects/${id}`,
        TesterProjectDetailDataSchema,
        { withCredentials: true },
      )
      .pipe(timeout(20000));
  }
  activity(): Observable<TesterActivityData> {
    return this.api
      .request('GET', '/testers/activity', TesterActivityDataSchema, {
        withCredentials: true,
      })
      .pipe(timeout(20000));
  }
  applications(id: string): Observable<TesterApplicationsData> {
    return this.api
      .request(
        'GET',
        `/testers/projects/${id}/applications`,
        TesterApplicationsDataSchema,
        { withCredentials: true },
      )
      .pipe(timeout(20000));
  }
  save(
    input: TesterProjectInput,
    id?: string,
  ): Observable<TesterProjectDetailData> {
    return this.api
      .request(
        id ? 'PUT' : 'POST',
        `/testers/projects${id ? `/${id}` : ''}`,
        TesterProjectDetailDataSchema,
        { withCredentials: true, body: TesterProjectInputSchema.parse(input) },
      )
      .pipe(timeout(20000));
  }
  apply(id: string, message: string): Observable<TesterProjectDetailData> {
    return this.api
      .request(
        'PUT',
        `/testers/projects/${id}/applications/me`,
        TesterProjectDetailDataSchema,
        {
          withCredentials: true,
          body: TesterApplicationInputSchema.parse({ message }),
        },
      )
      .pipe(timeout(20000));
  }
  withdraw(id: string): Observable<TesterProjectDetailData> {
    return this.api
      .request(
        'DELETE',
        `/testers/projects/${id}/applications/me`,
        TesterProjectDetailDataSchema,
        { withCredentials: true },
      )
      .pipe(timeout(20000));
  }
  decide(
    id: string,
    applicationId: string,
    status: 'accepted' | 'declined',
  ): Observable<TesterProjectDetailData> {
    return this.api
      .request(
        'PATCH',
        `/testers/projects/${id}/applications/${applicationId}`,
        TesterProjectDetailDataSchema,
        {
          withCredentials: true,
          body: TesterApplicationStatusInputSchema.parse({ status }),
        },
      )
      .pipe(timeout(20000));
  }
  feedback(
    id: string,
    input: TesterFeedbackInput,
  ): Observable<TesterProjectDetailData> {
    return this.api
      .request(
        'PUT',
        `/testers/projects/${id}/feedback/me`,
        TesterProjectDetailDataSchema,
        { withCredentials: true, body: TesterFeedbackInputSchema.parse(input) },
      )
      .pipe(timeout(20000));
  }
}
