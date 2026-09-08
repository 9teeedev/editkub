"use client";

/** Height of the timecode/control row above the ruler (+ its border). */
const CONTROL_ROW_OFFSET = 33;

export function MobilePlayhead() {
	return (
		<div
			className="bg-foreground pointer-events-none absolute bottom-0 left-1/2 z-30 -translate-x-1/2"
			style={{ width: 2, top: CONTROL_ROW_OFFSET }}
		>
			{/* Circle indicator at the top of the ruler, clear of the timecode row */}
			<div className="bg-foreground border-foreground/50 absolute top-1 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 shadow-xs" />
		</div>
	);
}
