#!/usr/bin/env bun
/**
 * Developer-only Thai Caption Benchmark runner.
 * Usage:
 *   bun scripts/benchmark-captions.ts [path-to-benchmark.json]
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
	evaluateBenchmark,
	type BenchmarkInput,
	type ProviderMetrics,
} from "./caption-benchmark/calculator";

function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

function formatCost(val: number | null): string {
	if (val === null) return "N/A";
	return `$${val.toFixed(4)}/min`;
}

function printReport(metrics: ProviderMetrics[]) {
	console.log("\n=======================================================");
	console.log("       EDITKUB THAI CAPTION BENCHMARK REPORT           ");
	console.log("=======================================================\n");

	if (metrics.length === 0) {
		console.log("No provider results found in input.");
		return;
	}

	const headers = [
		"Provider",
		"Mode",
		"Runs",
		"Fail%",
		"Med CER",
		"Med WER",
		"Med Lat",
		"P95 Lat",
		"Med RTF",
		"Est Cost",
	];

	const rows = metrics.map((m) => [
		m.provider,
		m.mode,
		`${m.successfulSamples}/${m.totalSamples}`,
		formatPercent(m.failureRate),
		formatPercent(m.medianCer),
		formatPercent(m.medianWer),
		`${m.medianLatency.toFixed(2)}s`,
		`${m.p95Latency.toFixed(2)}s`,
		`${m.medianRtf.toFixed(2)}x`,
		formatCost(m.costPerAudioMinute),
	]);

	const colWidths = headers.map((h, idx) =>
		Math.max(h.length, ...rows.map((r) => r[idx].length)),
	);

	const formatRow = (cols: string[]) =>
		cols.map((c, i) => c.padEnd(colWidths[i])).join(" | ");

	console.log(formatRow(headers));
	console.log(colWidths.map((w) => "-".repeat(w)).join("-|-"));
	for (const row of rows) {
		console.log(formatRow(row));
	}

	console.log("\n-------------------------------------------------------");
	console.log("Decision Gate Evaluation (Hypotheses):");
	console.log("-------------------------------------------------------");

	const local = metrics.find((m) => m.mode === "local");
	const remotes = metrics.filter((m) => m.mode === "remote");

	if (!local) {
		console.log("ℹ Baseline 'local' provider metrics not found in sample.");
	} else if (remotes.length === 0) {
		console.log("ℹ No 'remote' candidate providers found to compare.");
	} else {
		for (const remote of remotes) {
			const cerImprovement =
				local.medianCer > 0
					? ((local.medianCer - remote.medianCer) / local.medianCer) * 100
					: 0;
			const passAccuracyGate = cerImprovement >= 20;
			const passCompletionGate = remote.failureRate <= 0.05;

			console.log(`Candidate Provider [${remote.provider}]:`);
			console.log(
				`  • Accuracy Gate: Thai CER improvement vs local = ${cerImprovement.toFixed(1)}% (Target >= 20%) -> ${
					passAccuracyGate ? "PASSED" : "NOT MET"
				}`,
			);
			console.log(
				`  • Completion Rate Gate: ${((1 - remote.failureRate) * 100).toFixed(1)}% (Target >= 95%) -> ${
					passCompletionGate ? "PASSED" : "NOT MET"
				}`,
			);
			console.log(
				`  • Measured API Cost: ${formatCost(remote.costPerAudioMinute)} (Evaluate >= 60% gross margin target against pricing model)`,
			);
		}
	}

	console.log("\nIMPORTANT NOTICE:");
	console.log(
		"Benchmark infrastructure is complete. Real Phase 2 decision gating requires",
	);
	console.log(
		"evaluating consented Thai speech material across the pilot evaluation matrix.",
	);
	console.log("=======================================================\n");
}

function main() {
	const defaultFixture = resolve(
		__dirname,
		"caption-benchmark/synthetic-fixture.json",
	);
	const targetPath = process.argv[2]
		? resolve(process.argv[2])
		: defaultFixture;

	if (!existsSync(targetPath)) {
		console.error(`Error: input file not found at ${targetPath}`);
		process.exit(1);
	}

	console.log(`Loading benchmark input from: ${targetPath}`);
	const raw = readFileSync(targetPath, "utf8");
	const input: BenchmarkInput = JSON.parse(raw);

	const metrics = evaluateBenchmark(input);
	printReport(metrics);
}

main();
