import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTesters1791000000000 implements MigrationInterface {
  name = 'CreateTesters1791000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tester_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_hash varchar(64) NOT NULL,
        display_name varchar(80) NOT NULL,
        city varchar(100) NOT NULL,
        bio text NOT NULL,
        skills jsonb NOT NULL DEFAULT '[]',
        resources jsonb NOT NULL DEFAULT '[]',
        accessibility_needs text NOT NULL DEFAULT '',
        interests jsonb NOT NULL DEFAULT '[]',
        availability varchar(10) NOT NULL CHECK (availability IN ('remote', 'onsite', 'hybrid')),
        consent boolean NOT NULL DEFAULT true CHECK (consent = true),
        is_active boolean NOT NULL DEFAULT true,
        is_demo boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_tester_profiles_owner UNIQUE (owner_hash)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE tester_searches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_hash varchar(64) NOT NULL,
        query text NOT NULL,
        summary text NOT NULL,
        matches jsonb NOT NULL,
        candidate_count integer NOT NULL,
        total_profiles integer NOT NULL,
        candidate_limit integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX idx_tester_searches_owner_created ON tester_searches (owner_hash, created_at)');
    await queryRunner.query(`
      CREATE TABLE tester_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        search_id uuid NOT NULL REFERENCES tester_searches(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES tester_profiles(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_tester_assignments_search_profile UNIQUE (search_id, profile_id)
      )
    `);
  }

  down(): Promise<void> {
    return Promise.reject(new Error('Ta migracja przechowuje profile użytkowników. Wycofanie wymaga osobnego, uzgodnionego planu zachowania danych.'));
  }
}
