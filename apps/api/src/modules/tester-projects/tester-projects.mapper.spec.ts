import { toProject } from './tester-projects.mapper.js';
import type { StoredProject } from './tester-projects.repository.js';

describe('tester project public mapping', () => {
  const stored: StoredProject = {
    id: 'aab682fd-ab86-4407-8663-853cab7d433d',
    ownerId: 'private-owner',
    organizerName: 'Fundacja',
    title: 'Test aplikacji',
    description: 'Opis innowacji i planowanego testowania.',
    requirements: 'Smartfon i czas na test',
    location: '',
    mode: 'remote',
    stage: 'idea',
    status: 'open',
    createdAt: new Date('2026-10-03T12:00:00Z'),
    updatedAt: new Date('2026-10-03T12:00:00Z'),
    applications: [
      { status: 'pending' },
      { status: 'accepted' },
      { status: 'withdrawn' },
    ],
    feedback: [{ rating: 3 }, { rating: 4 }, { rating: 4 }],
  };
  it('counts active recruitment and rounds the average while stripping the owner ID', () => {
    const result = toProject(stored, 'private-owner');
    expect(result).toMatchObject({
      applicationCount: 2,
      acceptedCount: 1,
      feedbackCount: 3,
      averageRating: 3.7,
      isOwner: true,
    });
    expect(JSON.stringify(result)).not.toContain('private-owner');
    expect(toProject(stored).isOwner).toBe(false);
  });
  it('does not invent a rating when the project has no reviews', () => {
    expect(toProject({ ...stored, feedback: [] })).toMatchObject({
      feedbackCount: 0,
      averageRating: null,
    });
  });
});
