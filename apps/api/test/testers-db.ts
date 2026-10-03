import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

export async function createTestersDatabase(url: string): Promise<string> {
  const schema = `testers_e2e_${randomUUID().replaceAll('-', '')}`;
  const pool = new Pool({ connectionString: url });
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query(`CREATE SCHEMA "${schema}"`);
    await connection.query(`SET LOCAL search_path TO "${schema}"`);
    const directory = new URL('../prisma/migrations/', import.meta.url);
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const migration of migrations) {
      const sql = await readFile(
        new URL(`${migration}/migration.sql`, directory),
        'utf8',
      );
      await connection.query(sql);
    }
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
  return schema;
}

export function connectTestersDatabase(
  url: string,
  schema: string,
): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema }),
  });
}
