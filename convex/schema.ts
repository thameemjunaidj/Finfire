/**
 * convex/schema.ts — the only thing the server stores.
 *
 * One table, one row per person: a copy of what is on their phone, so that
 * losing the phone does not lose their money history. Nothing is stored unless
 * the person turns backup on, and one tap deletes it for good.
 *
 * Backup is a copy, not the source of truth. The phone stays authoritative —
 * the app works exactly the same with backup off, and everything is still
 * analysed on the device.
 */

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  backups: defineTable({
    /** Lower-cased email or phone the person signed in with. */
    owner: v.string(),
    /** The phone's saved state, as JSON. */
    payload: v.string(),
    /** So the app can say "last backed up 2 hours ago". */
    updatedAt: v.number(),
    /** Shown before restoring, so nobody overwrites a fuller account with an
     *  emptier one without seeing it coming. */
    transactionCount: v.number(),
  }).index('by_owner', ['owner']),
});
