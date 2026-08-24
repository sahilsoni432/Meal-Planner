/**
 * Client-only. The day slots and the modal all take array properties, which cannot survive
 * server-rendered markup as stringified attributes. The planner has no SEO value.
 */
export const ssr = false;
