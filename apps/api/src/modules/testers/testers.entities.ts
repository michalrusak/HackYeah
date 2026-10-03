import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { TesterAiResult, TesterProfileInput } from '@repo/api-contracts';

@Entity('tester_profiles')
@Index('uq_tester_profiles_owner', ['ownerHash'], { unique: true })
export class TesterProfileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'owner_hash', type: 'varchar', length: 64, select: false }) ownerHash: string;
  @Column({ name: 'display_name', type: 'varchar', length: 80 }) displayName: string;
  @Column({ type: 'varchar', length: 100 }) city: string;
  @Column({ type: 'text' }) bio: string;
  @Column({ type: 'jsonb', default: [] }) skills: string[];
  @Column({ type: 'jsonb', default: [] }) resources: string[];
  @Column({ name: 'accessibility_needs', type: 'text', default: '' }) accessibilityNeeds: string;
  @Column({ type: 'jsonb', default: [] }) interests: string[];
  @Column({ type: 'varchar', length: 10 }) availability: TesterProfileInput['availability'];
  @Column({ type: 'boolean', default: true }) consent: true;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ name: 'is_demo', type: 'boolean', default: false }) isDemo: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity('tester_searches')
@Index('idx_tester_searches_owner_created', ['ownerHash', 'createdAt'])
export class TesterSearchEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'owner_hash', type: 'varchar', length: 64, select: false }) ownerHash: string;
  @Column({ type: 'text' }) query: string;
  @Column({ type: 'text' }) summary: string;
  @Column({ type: 'jsonb' }) matches: TesterAiResult['matches'];
  @Column({ name: 'candidate_count', type: 'integer' }) candidateCount: number;
  @Column({ name: 'total_profiles', type: 'integer' }) totalProfiles: number;
  @Column({ name: 'candidate_limit', type: 'integer' }) candidateLimit: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

@Entity('tester_assignments')
@Index('uq_tester_assignments_search_profile', ['searchId', 'profileId'], { unique: true })
export class TesterAssignmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'search_id', type: 'uuid' }) searchId: string;
  @Column({ name: 'profile_id', type: 'uuid' }) profileId: string;
  @ManyToOne(() => TesterSearchEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'search_id' }) search: TesterSearchEntity;
  @ManyToOne(() => TesterProfileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' }) profile: TesterProfileEntity;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
