import { findFreePorts } from "find-free-ports";
import { Mutex } from "async-mutex";

const allocatedPorts = new Set<number>();
const allocatedSegments = new Set<number>();
const portMutex = new Mutex();
const SEGMENT_SIZE = 1000;
const START_PORT = 10000;
const END_PORT = 60000;
const TOTAL_SEGMENTS = Math.floor((END_PORT - START_PORT) / SEGMENT_SIZE);

function getSegmentRange(segmentIndex: number): { start: number; end: number } {
	const start = START_PORT + segmentIndex * SEGMENT_SIZE;
	const end = start + SEGMENT_SIZE - 1;
	return { start, end };
}

export async function getFreePorts(count: number): Promise<number[]> {
	const release = await portMutex.acquire();
	try {
		let segmentIndex = 0;

		// Find an unallocated segment
		while (segmentIndex < TOTAL_SEGMENTS && allocatedSegments.has(segmentIndex)) {
			segmentIndex++;
		}

		if (segmentIndex >= TOTAL_SEGMENTS) {
			throw new Error("No available port segments");
		}

		allocatedSegments.add(segmentIndex);
		const { start, end } = getSegmentRange(segmentIndex);

		const availablePorts = await findFreePorts(count, { startPort: start, endPort: end });
		const ports = [];

		for (const port of availablePorts) {
			if (!allocatedPorts.has(port)) {
				allocatedPorts.add(port);
				ports.push(port);
			}
			if (ports.length === count) break;
		}

		if (ports.length < count) {
			throw new Error("Not enough free ports available in the allocated segment");
		}

		return ports;
	} finally {
		release();
	}
}

export function releasePort(port: number): void {
	portMutex.runExclusive(() => {
		allocatedPorts.delete(port);
	});
}

export function releaseSegment(segmentIndex: number): void {
	portMutex.runExclusive(() => {
		allocatedSegments.delete(segmentIndex);
	});
}
