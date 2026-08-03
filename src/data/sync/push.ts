import { supabase } from '@/data/supabase/client'
import type { Op, OpEntity } from './outbox'

/**
 * Applies one queued op to Supabase.
 *
 * `user_id` is injected here rather than stored in the op, so the store stays
 * completely unaware of auth and a queued op written while signed out still
 * lands correctly once a session exists.
 */

export type PushResult = 'ok' | 'retry' | 'dead'

const TABLES: Record<OpEntity, string> = {
  entry: 'entries',
  ranking: 'rankings',
  collection: 'collections',
  collection_item: 'collection_items',
  activity: 'activity',
  profile: 'profiles',
}

/** Postgres error codes that will fail identically forever. */
const PERMANENT = new Set([
  '23514', // check_violation — bad score step, over-length note
  '23503', // foreign_key_violation — parent collection already deleted
  '42501', // insufficient_privilege — RLS denial
  '22P02', // invalid_text_representation
]);

export async function pushOp(op: Op, userId: string): Promise<PushResult> {
  if (!supabase) return 'retry'

  const table = TABLES[op.entity]

  try {
    if (op.action === 'delete') {
      const query = supabase.from(table).delete()

      switch (op.entity) {
        case 'entry':
          await query.eq('user_id', userId).eq('media_id', op.payload.media_id as number)
          break
        case 'ranking':
          await query
            .eq('user_id', userId)
            .eq('kind', op.payload.kind as string)
            .eq('media_id', op.payload.media_id as number)
          break
        default:
          await query.eq('user_id', userId).eq('id', op.payload.id as string)
      }

      return 'ok'
    }

    const row = { ...op.payload, user_id: userId }

    // Conflict targets mirror the schema's primary keys / unique indexes.
    const onConflict =
      op.entity === 'entry'
        ? 'user_id,media_id'
        : op.entity === 'ranking'
          ? 'user_id,kind,media_id'
          : 'id'

    if (op.entity === 'profile') {
      // profiles.id is the auth user id; the row is created by a trigger on
      // signup, so this is always an update.
      const { error } = await supabase.from(table).update(op.payload).eq('id', userId)
      if (error) throw error
      return 'ok'
    }

    if (op.entity === 'activity') {
      // Append-only with a client-generated uuid, so a replayed op is a no-op
      // rather than a duplicate event.
      const { error } = await supabase.from(table).upsert(row, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      return 'ok'
    }

    const { error } = await supabase.from(table).upsert(row, { onConflict })
    if (error) throw error

    return 'ok'
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code && PERMANENT.has(code)) return 'dead'

    // Anything else — offline, 5xx, timeout — is worth another go.
    return 'retry'
  }
}
