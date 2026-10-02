// Global type declarations for Supabase Edge Functions (Deno runtime)
// This ensures VS Code TypeScript language server recognizes Deno and HTTPS URL imports without errors.

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  export const env: Env;
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): any;
}

declare module 'https://*' {
  export const serve: any;
  export const createClient: any;
  const content: any;
  export default content;
}
