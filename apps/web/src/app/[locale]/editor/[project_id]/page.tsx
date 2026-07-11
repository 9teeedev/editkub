"use client";

import { useParams } from "next/navigation";
import { lazy, Suspense } from "react";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import { AssetsPanel } from "@/components/editor/panels/assets";
import { AgentPanel } from "@/components/editor/panels/agent";
import { PropertiesPanel } from "@/components/editor/panels/properties";
import { Timeline } from "@/components/editor/panels/timeline";
import { PreviewPanel } from "@/components/editor/panels/preview";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorProvider } from "@/components/providers/editor-provider";
// import { Onboarding } from "@/components/editor/onboarding";
import { MigrationDialog } from "@/components/editor/dialogs/migration-dialog";
import { usePanelStore } from "@/stores/panel-store";
import { useAgentStore } from "@/stores/agent-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEditor } from "@/hooks/use-editor";

const MobileEditorLayout = lazy(() =>
	import("@/components/editor/mobile/mobile-editor-layout").then((m) => ({
		default: m.MobileEditorLayout,
	})),
);

export default function Editor() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<EditorProvider projectId={projectId}>
			<EditorShell />
		</EditorProvider>
	);
}

function EditorShell() {
	const isMobile = useIsMobile();

	return (
		<div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
			{isMobile ? (
				<Suspense
					fallback={
						<div className="flex h-screen items-center justify-center">
							Loading...
						</div>
					}
				>
					<MobileEditorLayout />
				</Suspense>
			) : (
				<>
					<EditorHeader />
					<div className="min-h-0 min-w-0 flex-1 px-3 pb-3">
						<EditorLayout />
					</div>
				</>
			)}
			{/* <Onboarding /> */}
			<MigrationDialog />
		</div>
	);
}

function EditorLayout() {
	const { panels, setPanel } = usePanelStore();
	const isAgentOpen = useAgentStore((s) => s.isOpen);
	const editor = useEditor();
	const layoutMode = editor.project.getLayoutMode();
	const isVertical = layoutMode === "vertical";

	if (isVertical) {
		// Vertical: Preview is a full-height sibling on the right.
		// Left side = Assets|Properties (top) + Timeline (bottom).
		const leftDefault = 100 - panels.preview - (isAgentOpen ? panels.agent : 0);

		return (
			<ResizablePanelGroup
				direction="horizontal"
				className="size-full gap-[0.19rem]"
				onLayout={(sizes) => {
					setPanel("preview", sizes[1] ?? panels.preview);
					if (isAgentOpen && sizes[2] != null) {
						setPanel("agent", sizes[2]);
					}
				}}
			>
				<ResizablePanel
					defaultSize={leftDefault}
					minSize={30}
					className="min-w-0"
				>
					<ResizablePanelGroup
						direction="vertical"
						className="size-full gap-[0.18rem]"
						onLayout={(sizes) => {
							setPanel("mainContent", sizes[0] ?? panels.mainContent);
							setPanel("timeline", sizes[1] ?? panels.timeline);
						}}
					>
						<ResizablePanel
							defaultSize={panels.mainContent}
							minSize={30}
							maxSize={85}
							className="min-h-0"
						>
							<ResizablePanelGroup
								direction="horizontal"
								className="size-full gap-[0.19rem]"
								onLayout={(sizes) => {
									setPanel("tools", sizes[0] ?? panels.tools);
									setPanel("properties", sizes[1] ?? panels.properties);
								}}
							>
								<ResizablePanel
									defaultSize={panels.tools}
									minSize={15}
									maxSize={40}
									className="min-w-0"
								>
									<AssetsPanel />
								</ResizablePanel>

								<ResizableHandle withHandle />

								<ResizablePanel
									defaultSize={panels.properties}
									minSize={15}
									maxSize={40}
									className="min-w-0"
								>
									<PropertiesPanel />
								</ResizablePanel>
							</ResizablePanelGroup>
						</ResizablePanel>

						<ResizableHandle withHandle />

						<ResizablePanel
							defaultSize={panels.timeline}
							minSize={15}
							maxSize={70}
							className="min-h-0"
						>
							<Timeline />
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>

				<ResizableHandle withHandle />

				<ResizablePanel
					defaultSize={panels.preview}
					minSize={30}
					className="min-w-0"
				>
					<PreviewPanel />
				</ResizablePanel>

				{isAgentOpen && (
					<>
						<ResizableHandle withHandle />
						<ResizablePanel
							defaultSize={panels.agent}
							minSize={15}
							maxSize={35}
							className="min-w-0"
						>
							<AgentPanel />
						</ResizablePanel>
					</>
				)}
			</ResizablePanelGroup>
		);
	}

	// Landscape (default): Assets | Preview | Properties (top) + Timeline (bottom)
	return (
		<ResizablePanelGroup
			direction="horizontal"
			className="size-full gap-[0.19rem]"
			onLayout={(sizes) => {
				if (isAgentOpen && sizes[1] != null) {
					setPanel("agent", sizes[1]);
				}
			}}
		>
			<ResizablePanel
				defaultSize={isAgentOpen ? 100 - panels.agent : 100}
				minSize={50}
				className="min-w-0"
			>
				<ResizablePanelGroup
					direction="vertical"
					className="size-full gap-[0.18rem]"
					onLayout={(sizes) => {
						setPanel("mainContent", sizes[0] ?? panels.mainContent);
						setPanel("timeline", sizes[1] ?? panels.timeline);
					}}
				>
					<ResizablePanel
						defaultSize={panels.mainContent}
						minSize={30}
						maxSize={85}
						className="min-h-0"
					>
						<ResizablePanelGroup
							direction="horizontal"
							className="size-full gap-[0.19rem]"
							onLayout={(sizes) => {
								setPanel("tools", sizes[0] ?? panels.tools);
								setPanel("preview", sizes[1] ?? panels.preview);
								setPanel("properties", sizes[2] ?? panels.properties);
							}}
						>
							<ResizablePanel
								defaultSize={panels.tools}
								minSize={15}
								maxSize={40}
								className="min-w-0"
							>
								<AssetsPanel />
							</ResizablePanel>

							<ResizableHandle withHandle />

							<ResizablePanel
								defaultSize={panels.preview}
								minSize={30}
								className="min-h-0 min-w-0 flex-1"
							>
								<PreviewPanel />
							</ResizablePanel>

							<ResizableHandle withHandle />

							<ResizablePanel
								defaultSize={panels.properties}
								minSize={15}
								maxSize={40}
								className="min-w-0"
							>
								<PropertiesPanel />
							</ResizablePanel>
						</ResizablePanelGroup>
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						defaultSize={panels.timeline}
						minSize={15}
						maxSize={70}
						className="min-h-0"
					>
						<Timeline />
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>

			{isAgentOpen && (
				<>
					<ResizableHandle withHandle />
					<ResizablePanel
						defaultSize={panels.agent}
						minSize={15}
						maxSize={35}
						className="min-w-0"
					>
						<AgentPanel />
					</ResizablePanel>
				</>
			)}
		</ResizablePanelGroup>
	);
}
