import { Inject, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRlsClient } from "./supabase-clients";

/**
 * Request-scoped: one RLS-bound Supabase client per HTTP request, built
 * from the caller's bearer token. This is the REST-controller-facing
 * equivalent of trpc/context.ts's client construction — same underlying
 * helper, different entry point, so both protocols enforce RLS identically.
 */
@Injectable({ scope: Scope.REQUEST })
export class RlsSupabaseService {
  private client: SupabaseClient | null = null;

  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get(): SupabaseClient {
    if (this.client) return this.client;
    const header = this.request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) throw new UnauthorizedException("Missing bearer token");
    this.client = createRlsClient(token);
    return this.client;
  }
}
