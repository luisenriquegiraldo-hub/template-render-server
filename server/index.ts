import express from "express";
import { makeRenderQueue } from "./render-queue";
import { bundle } from "@remotion/bundler";
import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";
import { z } from "zod";

const { PORT = 3000, REMOTION_SERVE_URL, PUBLIC_BASE_URL } = process.env;

const renderRequestSchema = z.object({
  scenes: z
    .array(
      z.object({
        imageUrl: z.string(),
        durationSeg: z.number(),
      }),
    )
    .min(1),
  voiceUrl: z.string(),
  musicUrl: z.string(),
  captions: z.array(
    z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
    }),
  ),
  outroVideoUrl: z.string().default(""),
});

function setupApp({
  remotionBundleUrl,
  publicBaseUrl,
}: {
  remotionBundleUrl: string;
  publicBaseUrl: string;
}) {
  const app = express();

  const rendersDir = path.resolve("renders");

  const queue = makeRenderQueue({
    port: Number(PORT),
    serveUrl: remotionBundleUrl,
    rendersDir,
    publicBaseUrl,
  });

  // Host renders on /renders
  app.use("/renders", express.static(rendersDir));
  app.use(express.json({ limit: "2mb" }));

  // Endpoint to create a new job
  app.post("/renders", async (req, res) => {
    const parsed = renderRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid render payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const jobId = queue.createJob(parsed.data);

    res.json({ jobId });
  });

  // Endpoint to get a job status
  app.get("/renders/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    const job = queue.jobs.get(jobId);

    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    res.json(job);
  });

  // Endpoint to cancel a job
  app.delete("/renders/:jobId", (req, res) => {
    const jobId = req.params.jobId;

    const job = queue.jobs.get(jobId);

    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    if (job.status !== "queued" && job.status !== "in-progress") {
      res.status(400).json({ message: "Job is not cancellable" });
      return;
    }

    job.cancel();

    res.json({ message: "Job cancelled" });
  });

  return app;
}

async function main() {
  await ensureBrowser();

  if (!PUBLIC_BASE_URL) {
    throw new Error(
      "PUBLIC_BASE_URL env var is required (public URL of this server, e.g. https://fabrica-remotion.1v3vdd.easypanel.host) — n8n needs a reachable videoUrl, not localhost.",
    );
  }

  const remotionBundleUrl = REMOTION_SERVE_URL
    ? REMOTION_SERVE_URL
    : await bundle({
        entryPoint: path.resolve("remotion/index.ts"),
        onProgress(progress) {
          console.info(`Bundling Remotion project: ${progress}%`);
        },
      });

  const app = setupApp({ remotionBundleUrl, publicBaseUrl: PUBLIC_BASE_URL });

  app.listen(PORT, () => {
    console.info(`Server is running on port ${PORT}`);
  });
}

main();
