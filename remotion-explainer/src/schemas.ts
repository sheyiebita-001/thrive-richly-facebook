import { z } from "zod";

export const ChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
});

export const SceneSchema = z.object({
  id: z.string(),
  type: z.enum(["intro", "concept", "example", "comparison", "chart", "keypoints", "quote", "recap", "outro"]),
  title: z.string(),
  narration: z.string(),
  onScreenText: z.object({
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    bodyText: z.string().optional(),
    bulletPoints: z.array(z.string()).optional(),
    chartType: z.enum(["bar", "line", "pie"]).optional(),
    chartData: z.array(ChartDataPointSchema).optional(),
    chartTitle: z.string().optional(),
    comparisonLeft: z.object({ title: z.string(), points: z.array(z.string()), color: z.string() }).optional(),
    comparisonRight: z.object({ title: z.string(), points: z.array(z.string()), color: z.string() }).optional(),
    bigNumber: z.string().optional(),
    bigNumberLabel: z.string().optional(),
    quoteText: z.string().optional(),
    quoteAuthor: z.string().optional(),
  }),
  transitionToNext: z.enum(["fade", "slide", "wipe", "none"]).default("fade"),
});

export const ColorSchemeSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  text: z.string(),
  muted: z.string(),
});

export const VideoScriptSchema = z.object({
  topic: z.string(),
  description: z.string(),
  targetDurationMinutes: z.number(),
  colorScheme: ColorSchemeSchema,
  scenes: z.array(SceneSchema),
  hasVoiceover: z.boolean().optional().default(false),
  sceneDurations: z.array(z.number()).optional(),
});

export type VideoScript = z.infer<typeof VideoScriptSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type ColorScheme = z.infer<typeof ColorSchemeSchema>;
export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;
