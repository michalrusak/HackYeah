import {
  TesterApplicationSchema,
  TesterFeedbackSchema,
  TesterProjectSchema,
  type TesterApplication,
  type TesterFeedback,
  type TesterProject,
} from '@repo/api-contracts';
import type {
  TesterProjectApplication,
  TesterProjectFeedback,
} from '../../generated/prisma/client.js';
import type { StoredProject } from './tester-projects.repository.js';

export function toProject(
  project: StoredProject,
  accountId?: string,
): TesterProject {
  const ratings = project.feedback.map((item) => item.rating);
  return TesterProjectSchema.parse({
    id: project.id,
    organizerName: project.organizerName,
    title: project.title,
    description: project.description,
    requirements: project.requirements,
    location: project.location,
    mode: project.mode,
    stage: project.stage,
    status: project.status,
    isOwner: project.ownerId === accountId,
    applicationCount: project.applications.filter(
      (item) => item.status !== 'withdrawn',
    ).length,
    acceptedCount: project.applications.filter(
      (item) => item.status === 'accepted',
    ).length,
    feedbackCount: ratings.length,
    averageRating: ratings.length
      ? Math.round(
          (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) *
            10,
        ) / 10
      : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
}

export function toApplication(
  application: TesterProjectApplication,
): TesterApplication {
  return TesterApplicationSchema.parse({
    id: application.id,
    projectId: application.projectId,
    message: application.message,
    status: application.status,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  });
}

export function toFeedback(feedback: TesterProjectFeedback): TesterFeedback {
  return TesterFeedbackSchema.parse({
    id: feedback.id,
    projectId: feedback.projectId,
    authorName: feedback.authorName,
    rating: feedback.rating,
    review: feedback.review,
    improvement: feedback.improvement,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
  });
}
