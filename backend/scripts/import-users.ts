import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import prisma from '../src/db';

// Load .env from current directory or project root (when running from backend/)
const envInCwd = path.join(process.cwd(), '.env');
const envInParent = path.join(process.cwd(), '..', '.env');
if (fs.existsSync(envInCwd)) {
  dotenv.config({ path: envInCwd });
} else if (fs.existsSync(envInParent)) {
  dotenv.config({ path: envInParent });
}

type OldUserRecord = {
  name: string;
  address?: string | null;
  maxGuests?: number | null;
  notes?: string | null;
  email: string;
  diet?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Merges old record into existing user. Only fills missing/null/empty fields.
 * maxGuests is always overwritten if old value is a valid number (including 0).
 */
function buildMergedData(existing: {
  name: string;
  address: string | null;
  maxGuests: number;
  notes: string | null;
  email: string;
  diet: string | null;
}, old: OldUserRecord): Partial<OldUserRecord> {
  const update: Partial<OldUserRecord> = {};

  if (isBlank(existing.name) && !isBlank(old.name)) {
    update.name = old.name.trim();
  }

  if (isBlank(existing.address) && !isBlank(old.address)) {
    update.address = old.address.trim();
  }

  if (isBlank(existing.notes) && !isBlank(old.notes)) {
    update.notes = old.notes.trim();
  }

  if (isBlank(existing.diet) && !isBlank(old.diet)) {
    update.diet = old.diet.trim();
  }

  // maxGuests: if old record provides a numeric value (including 0), use it
  if (old.maxGuests !== undefined && old.maxGuests !== null) {
    update.maxGuests = old.maxGuests;
  }

  return update;
}

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, '../../old_version/Moving Dinner - Stammdaten.csv');

  if (!fs.existsSync(filePath)) {
    console.error(`Datei nicht gefunden: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ',',
  }) as Array<Record<string, string>>;

  let created = 0;
  let merged = 0;
  let skipped = 0;

  for (const record of records) {
    const email = normalizeEmail(record.Email || record.email || '');
    const name = (record.Name || record.name || '').trim();

    if (!email || !name) {
      console.warn(`Überspringe unvollständigen Datensatz: ${JSON.stringify(record)}`);
      skipped++;
      continue;
    }

    const old: OldUserRecord = {
      name,
      email,
      address: record['Adresse (Str. + Hn.)'] || record.address || null,
      maxGuests: parseMaxGuests(record['Maximale Anzahl an Gästen (ohne dich)'] || record.maxGuests || ''),
      notes: record['Sonstige Anmerkungen'] || record.notes || null,
      diet: record['Essensgewohnheiten'] || record.diet || null,
    };

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      const update = buildMergedData(existing, old);
      if (Object.keys(update).length > 0) {
        await prisma.user.update({
          where: { email },
          data: update,
        });
        console.log(`Merged: ${email} (${Object.keys(update).join(', ')})`);
        merged++;
      } else {
        console.log(`Unverändert: ${email}`);
      }
    } else {
      await prisma.user.create({
        data: {
          name: old.name,
          email: old.email,
          address: old.address || null,
          maxGuests: old.maxGuests ?? 0,
          notes: old.notes || null,
          diet: old.diet || null,
          isGuest: false,
          passwordHash: null,
        },
      });
      console.log(`Created: ${email}`);
      created++;
    }
  }

  console.log(`\nFertig. Created: ${created}, Merged: ${merged}, Skipped: ${skipped}`);
}

function parseMaxGuests(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (normalized === '') return null;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });