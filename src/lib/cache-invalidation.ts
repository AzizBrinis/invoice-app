import { revalidateTag, updateTag } from "next/cache";

const UPDATE_TAG_SERVER_ACTION_ERROR =
  "updateTag can only be called from within a Server Action";

export function refreshTagForMutation(tag: string) {
  try {
    // Server actions need read-your-own-writes semantics so the next refresh
    // does not hydrate stale cached data over fresh optimistic state.
    updateTag(tag);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(UPDATE_TAG_SERVER_ACTION_ERROR)
    ) {
      revalidateTag(tag, "max");
      return;
    }

    throw error;
  }
}
