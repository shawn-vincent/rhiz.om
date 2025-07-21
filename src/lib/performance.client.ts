// src/lib/performance.client.ts
"use client";

import { logger } from "./logger.client";

const perfLogger = logger.child({ name: "Performance" });

interface PerformanceMetrics {
	component: string;
	duration: number;
	memoryUsage?: number;
	timestamp: number;
}

class PerformanceMonitor {
	private metrics: PerformanceMetrics[] = [];
	private observers = new Map<string, PerformanceObserver>();

	constructor() {
		if (typeof window !== "undefined") {
			this.setupObservers();
		}
	}

	private setupObservers() {
		// Monitor First Contentful Paint
		if ("PerformanceObserver" in window) {
			try {
				const paintObserver = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						perfLogger.info(
							`${entry.name}: ${Math.round(entry.startTime)}ms`,
							{ entry: entry.toJSON() }
						);
					}
				});
				paintObserver.observe({ entryTypes: ["paint"] });
				this.observers.set("paint", paintObserver);
			} catch (e) {
				perfLogger.warn("Failed to setup paint observer", { error: e });
			}

			// Monitor Long Tasks (>50ms)
			try {
				const longTaskObserver = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						if (entry.duration > 50) {
							perfLogger.warn(
								`Long task detected: ${Math.round(entry.duration)}ms`,
								{ entry: entry.toJSON() }
							);
						}
					}
				});
				longTaskObserver.observe({ entryTypes: ["longtask"] });
				this.observers.set("longtask", longTaskObserver);
			} catch (e) {
				perfLogger.warn("Failed to setup longtask observer", { error: e });
			}
		}
	}

	// Measure component render performance
	measureComponent<T>(name: string, fn: () => T): T {
		const start = performance.now();
		const startMemory = this.getMemoryUsage();
		
		try {
			const result = fn();
			return result;
		} finally {
			const duration = performance.now() - start;
			const endMemory = this.getMemoryUsage();
			
			this.recordMetric({
				component: name,
				duration,
				memoryUsage: endMemory - startMemory,
				timestamp: Date.now(),
			});

			if (duration > 16) { // More than one frame at 60fps
				perfLogger.warn(`Slow render in ${name}: ${Math.round(duration)}ms`);
			}
		}
	}

	// Async version for measuring async operations
	async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
		const start = performance.now();
		const startMemory = this.getMemoryUsage();
		
		try {
			const result = await fn();
			return result;
		} finally {
			const duration = performance.now() - start;
			const endMemory = this.getMemoryUsage();
			
			this.recordMetric({
				component: name,
				duration,
				memoryUsage: endMemory - startMemory,
				timestamp: Date.now(),
			});

			if (duration > 100) { // Warn for slow async operations
				perfLogger.warn(`Slow async operation in ${name}: ${Math.round(duration)}ms`);
			}
		}
	}

	private getMemoryUsage(): number {
		if ("memory" in performance) {
			return (performance as any).memory?.usedJSHeapSize ?? 0;
		}
		return 0;
	}

	private recordMetric(metric: PerformanceMetrics) {
		this.metrics.push(metric);
		
		// Keep only last 100 metrics to prevent memory bloat
		if (this.metrics.length > 100) {
			this.metrics = this.metrics.slice(-100);
		}

		perfLogger.info(`${metric.component}: ${Math.round(metric.duration)}ms`, {
			memoryDelta: metric.memoryUsage,
		});
	}

	// Get performance summary
	getSummary(): { avgDuration: number; totalComponents: number; slowestComponents: Array<{ component: string; duration: number }> } {
		if (this.metrics.length === 0) return { avgDuration: 0, totalComponents: 0, slowestComponents: [] };

		const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
		const avgDuration = totalDuration / this.metrics.length;
		
		const slowestComponents = [...this.metrics]
			.sort((a, b) => b.duration - a.duration)
			.slice(0, 5)
			.map(({ component, duration }) => ({ component, duration }));

		return {
			avgDuration,
			totalComponents: this.metrics.length,
			slowestComponents,
		};
	}

	// Cleanup observers
	cleanup() {
		for (const observer of this.observers.values()) {
			observer.disconnect();
		}
		this.observers.clear();
		this.metrics = [];
	}
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for measuring component renders
export function usePerformanceTracking(componentName: string) {
	const trackRender = (callback: () => void) => {
		performanceMonitor.measureComponent(componentName, callback);
	};

	const trackAsync = async <T>(callback: () => Promise<T>): Promise<T> => {
		return performanceMonitor.measureAsync(componentName, callback);
	};

	return { trackRender, trackAsync };
}