// Keyset cursor for lists ordered by (createdAt desc, id desc).
// Rows inserted/deleted between page loads never cause skips or duplicates.

export type Page<T> = { items: T[]; nextCursor: string | null; total: number | null };

export function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.toISOString()}_${id}`;
}

// Prisma where-clause for "rows after this cursor".
export function afterCursor(cursor: string) {
  const i = cursor.indexOf("_");
  const createdAt = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

export function clampTake(take: number | undefined, fallback: number) {
  return Math.min(Math.max(take ?? fallback, 1), 500);
}
