/**
 * Supabase generated Database types.
 *
 * Generate / refresh with:
 *   npm run db:generate-types
 *   (requires local Supabase: supabase start)
 *
 * Until generated, this stub keeps imports stable. Prefer hand types in
 * `database.ts` for domain enums used by the app shell.
 *
 * DO NOT hand-edit a full schema here — regenerate from migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Minimal Database shape so `createClient<Database>()` compiles.
 * Replace via `supabase gen types typescript`.
 */
export type Database = {
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T] extends { Row: infer R } ? R : never;
