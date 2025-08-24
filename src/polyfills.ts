// Polyfills for browser compatibility
// Required for Supabase and other libraries that use Node.js features

// Ensure Promise is available globally
if (typeof Promise === 'undefined') {
  throw new Error('Promise is not available. Please use a modern browser.');
}

// Patch the Deferred class for Supabase auth if needed
// This fixes the "d.resolve is not a function" error in minified builds
if (typeof window !== 'undefined') {
  // Create a proper Deferred class that matches Supabase's implementation
  class DeferredPolyfill<T = any> {
    promise: Promise<T>;
    resolve!: (value: T | PromiseLike<T>) => void;
    reject!: (reason?: any) => void;

    constructor() {
      this.promise = new Promise<T>((res, rej) => {
        this.resolve = res;
        this.reject = rej;
      });
    }

    static promiseConstructor = Promise;
  }

  // @ts-ignore - Patch global window
  window.Deferred = DeferredPolyfill;
  
  // Also ensure it's available as a global
  if (typeof globalThis !== 'undefined') {
    // @ts-ignore
    (globalThis as any).Deferred = DeferredPolyfill;
  }
}

// Ensure global is defined
if (typeof global === 'undefined') {
  // @ts-ignore
  window.global = window;
}

// Ensure process.env and process.cwd are defined (for browser compatibility)
if (typeof process === 'undefined') {
  // @ts-ignore
  window.process = { 
    env: {},
    cwd: () => '/'
  } as any;
} else if (typeof process.cwd !== 'function') {
  // @ts-ignore - Add cwd if missing
  process.cwd = () => '/';
}

// Polyfill for path module (basic implementation for browser)
if (typeof window !== 'undefined' && !(window as any).path) {
  (window as any).path = {
    join: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
    resolve: (...parts: string[]) => '/' + parts.join('/').replace(/\/+/g, '/'),
    dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
    basename: (p: string) => p.substring(p.lastIndexOf('/') + 1),
    extname: (p: string) => {
      const lastDot = p.lastIndexOf('.');
      return lastDot > 0 ? p.substring(lastDot) : '';
    }
  };
}

// Export to ensure this file is included
export {};