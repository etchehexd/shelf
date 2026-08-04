import { supabase } from '@/data/supabase/client'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { clearOutbox } from './outbox'

/**
 * Erase everything.
 *
 * The one genuinely destructive operation in the product, and the only place
 * that is allowed to be: every other "remove" in the app is a single row with
 * an Undo attached.
 *
 * It exists because a clean slate has to actually be reachable. A profile that
 * accumulated under a persona the user never chose can't be fixed by editing
 * the display name — the rankings, the collections and the history all belong
 * to that persona too, and the only honest reset is to take all of it out.
 *
 * Order matters. The queue is emptied *first*: an outbox still holding upserts
 * for rows we are about to delete would helpfully recreate them a few seconds
 * later, which is the classic way a "delete everything" button quietly does
 * nothing.
 *
 * Rows are deleted rather than the auth user, so the account survives and the
 * next sign-in lands in a genuinely empty room instead of a login error.
 */
export async function wipeEverything(userId: string | null): Promise<void> {
  await clearOutbox()

  if (supabase && userId) {
    // `collection_items` and `activity` cascade from their parents, but they
    // are listed explicitly anyway: relying on a cascade to erase personal data
    // means one schema change away from silently leaving it behind.
    for (const table of [
      'activity',
      'collection_items',
      'collections',
      'rankings',
      'entries',
    ]) {
      await supabase.from(table).delete().eq('user_id', userId)
    }

    await supabase
      .from('profiles')
      .update({
        display_name: '',
        bio: null,
        avatar_url: null,
        banner_url: null,
        accent: null,
        is_public: false,
        widgets: [],
        favorite_genres: [],
      })
      .eq('id', userId)
  }

  useLibrary.getState().reset()

  // Back to first run, deliberately: an empty shelf with no way in is a dead
  // end, and the onboarding screen is the way in.
  usePrefs.getState().setOnboarded(false)
}
