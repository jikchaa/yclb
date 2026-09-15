import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

export const PROGRAMS = ['networking', 'gourmet', 'wine', 'insight', 'social'] as const;

const events = defineCollection({
  loader: file('src/data/events.json', {
    parser: (text) =>
      JSON.parse(text).events.map((e: Record<string, unknown>) => ({ id: e.slug, ...e })),
  }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    /* 위키에서 날짜를 확인하지 못한 건은 null 로 둔다. 추측해 채우지 않는다. */
    date: z.string().nullable(),
    place: z.string().optional(),
    program: z.enum(PROGRAMS),
    poster: z.string(),
    posterW: z.number(),
    posterH: z.number(),
    /* 날짜가 없는 건은 공개 페이지에 내지 않는다. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { events };
