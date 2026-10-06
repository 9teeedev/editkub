/**
 * Yield to the event loop so input events, paint, and timers can run.
 *
 * Long export/mix loops that never yield monopolize the main thread until
 * the browser shows a "page isn't responding" dialog; calling this
 * periodically (every few hundred milliseconds of work) keeps the page
 * interactive without measurably slowing the loop.
 */
export function yieldToMainThread(): Promise<void> {
	const scheduler = (
		globalThis as { scheduler?: { yield?: () => Promise<void> } }
	).scheduler;
	if (scheduler?.yield) {
		return scheduler.yield();
	}
	return new Promise((resolve) => setTimeout(resolve, 0));
}
