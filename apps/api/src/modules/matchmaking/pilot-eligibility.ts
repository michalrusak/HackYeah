import {
  PilotConditionsSchema,
  type PilotConditions,
} from '@repo/api-contracts';

interface ReviewedProject {
  status: string;
  stage: string;
  updatedAt: Date;
}
interface Publication {
  conditions: unknown;
  reviewedProjectUpdatedAt: Date;
}
export function activePilotConditions(
  project: ReviewedProject,
  listing: Publication | null,
  now = new Date(),
): PilotConditions | null {
  if (
    !listing ||
    project.status !== 'open' ||
    project.stage !== 'prototype' ||
    project.updatedAt.getTime() !== listing.reviewedProjectUpdatedAt.getTime()
  )
    return null;
  const parsed = PilotConditionsSchema.safeParse(listing.conditions);
  return parsed.success &&
    parsed.data.recruitmentEndsAt !== null &&
    Date.parse(parsed.data.recruitmentEndsAt) > now.getTime()
    ? parsed.data
    : null;
}
