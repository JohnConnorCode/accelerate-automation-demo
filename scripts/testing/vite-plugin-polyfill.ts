// Vite plugin to fix Supabase Deferred issue in production builds
export function supabasePolyfillPlugin() {
  return {
    name: 'supabase-polyfill',
    transform(code: string, id: string) {
      // Only apply to Supabase auth files
      if (id.includes('@supabase/auth-js')) {
        // Add a global Deferred polyfill at the top
        const polyfill = `
          if (typeof window !== 'undefined' && !window.Deferred) {
            window.Deferred = class Deferred {
              constructor() {
                this.promise = new Promise((resolve, reject) => {
                  this.resolve = resolve;
                  this.reject = reject;
                });
              }
            };
            window.Deferred.promiseConstructor = Promise;
          }
        `;
        return polyfill + '\n' + code;
      }
      return code;
    }
  };
}