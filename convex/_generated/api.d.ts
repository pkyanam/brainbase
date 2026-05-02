/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as dream from "../dream.js";
import type * as eval from "../eval.js";
import type * as eval_lara from "../eval_lara.js";
import type * as jobs from "../jobs.js";
import type * as lib_brainbase from "../lib/brainbase.js";
import type * as lib_orphanLinker from "../lib/orphanLinker.js";
import type * as lib_supabase from "../lib/supabase.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  dream: typeof dream;
  eval: typeof eval;
  eval_lara: typeof eval_lara;
  jobs: typeof jobs;
  "lib/brainbase": typeof lib_brainbase;
  "lib/orphanLinker": typeof lib_orphanLinker;
  "lib/supabase": typeof lib_supabase;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
