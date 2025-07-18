declare global {
  interface Window {
    define: ((name: string, dependencies: string[], factory: (...args: any[]) => any) => void) | undefined;
  }
  namespace NodeJS {
    interface Global {
      define: ((name: string, dependencies: string[], factory: (...args: any[]) => any) => void) | undefined;
    }
  }
}

// This is to ensure the file is treated as a module and not a global script
export {};