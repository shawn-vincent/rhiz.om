declare global {
	interface Window {
		define:
			| ((
					name: string,
					dependencies: string[],
					factory: (...args: unknown[]) => unknown,
			  ) => void)
			| undefined;
	}
	namespace NodeJS {
		interface Global {
			define:
				| ((
						name: string,
						dependencies: string[],
						factory: (...args: unknown[]) => unknown,
				  ) => void)
				| undefined;
		}
	}
}

// This is to ensure the file is treated as a module and not a global script
export {};
