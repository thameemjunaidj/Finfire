/**
 * convex/backup.ts — save, restore and delete.
 *
 * Deliberately three plain functions with no cleverness. Backup code is the
 * code you find out is broken on the worst day someone has had all year, so it
 * is worth being boring.
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/** Emails differ in case; the same person must not end up with two backups. */
function normaliseOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

/** Roughly 8 MB of JSON. Far more than a year of transactions, and small
 *  enough that a runaway client cannot fill the database. */
const MAX_PAYLOAD = 8_000_000;

export const save = mutation({
  args: {
    owner: v.string(),
    payload: v.string(),
    transactionCount: v.number(),
  },
  handler: async (ctx, args) => {
    const owner = normaliseOwner(args.owner);
    if (!owner) throw new Error('No account given.');
    if (args.payload.length > MAX_PAYLOAD) throw new Error('That backup is too large.');

    const existing = await ctx.db
      .query('backups')
      .withIndex('by_owner', (q) => q.eq('owner', owner))
      .unique();

    const record = {
      owner,
      payload: args.payload,
      transactionCount: args.transactionCount,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
      return { updatedAt: record.updatedAt, replaced: true };
    }
    await ctx.db.insert('backups', record);
    return { updatedAt: record.updatedAt, replaced: false };
  },
});

export const load = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    const owner = normaliseOwner(args.owner);
    if (!owner) return null;

    const existing = await ctx.db
      .query('backups')
      .withIndex('by_owner', (q) => q.eq('owner', owner))
      .unique();

    if (!existing) return null;
    return {
      payload: existing.payload,
      updatedAt: existing.updatedAt,
      transactionCount: existing.transactionCount,
    };
  },
});

/**
 * Delete everything held for this account.
 *
 * Actually deletes the row rather than flagging it — "delete my data" has to
 * mean the data is gone, not hidden. There is nothing else stored anywhere, so
 * after this the server holds nothing about this person at all.
 */
export const deleteEverything = mutation({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    const owner = normaliseOwner(args.owner);
    if (!owner) return { deleted: 0 };

    const rows = await ctx.db
      .query('backups')
      .withIndex('by_owner', (q) => q.eq('owner', owner))
      .collect();

    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length };
  },
});
