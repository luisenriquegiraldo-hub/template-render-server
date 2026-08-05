import {
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { randomUUID } from "node:crypto";
import path from "node:path";

interface SceneInput {
  imageUrl: string;
  durationSeg: number;
}

interface CaptionInput {
  text: string;
  start: number;
  end: number;
}

interface JobData {
  scenes: SceneInput[];
  voiceUrl: string;
  musicUrl: string;
  captions: CaptionInput[];
  outroVideoUrl: string;
}

type JobState =
  | {
      status: "queued";
      data: JobData;
      cancel: () => void;
    }
  | {
      status: "in-progress";
      progress: number;
      data: JobData;
      cancel: () => void;
    }
  | {
      status: "completed";
      videoUrl: string;
      data: JobData;
    }
  | {
      status: "failed";
      message: string;
      data: JobData;
    };

const compositionId = "FabricaVideo";

export const makeRenderQueue = ({
  port,
  serveUrl,
  rendersDir,
  publicBaseUrl,
}: {
  port: number;
  serveUrl: string;
  rendersDir: string;
  publicBaseUrl: string;
}) => {
  const jobs = new Map<string, JobState>();
  let queue: Promise<unknown> = Promise.resolve();

  const processRender = async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) {
      throw new Error(`Render job ${jobId} not found`);
    }

    const { cancel, cancelSignal } = makeCancelSignal();

    jobs.set(jobId, {
      status: "in-progress",
      progress: 0,
      cancel,
      data: job.data,
    });

    try {
      const inputProps = {
        scenes: job.data.scenes,
        voiceUrl: job.data.voiceUrl,
        musicUrl: job.data.musicUrl,
        captions: job.data.captions,
        outroVideoUrl: job.data.outroVideoUrl,
      };

      const composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps,
      });

      await renderMedia({
        cancelSignal,
        serveUrl,
        composition,
        inputProps,
        codec: "h264",
        onProgress: (progress) => {
          console.info(`${jobId} render progress:`, progress.progress);
          jobs.set(jobId, {
            status: "in-progress",
            progress: progress.progress,
            cancel,
            data: job.data,
          });
        },
        outputLocation: path.join(rendersDir, `${jobId}.mp4`),
      });

      jobs.set(jobId, {
        status: "completed",
        videoUrl: `${publicBaseUrl}/renders/${jobId}.mp4`,
        data: job.data,
      });
    } catch (error) {
      console.error(error);
      jobs.set(jobId, {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        data: job.data,
      });
    }
  };

  const queueRender = async ({
    jobId,
    data,
  }: {
    jobId: string;
    data: JobData;
  }) => {
    jobs.set(jobId, {
      status: "queued",
      data,
      cancel: () => {
        jobs.delete(jobId);
      },
    });

    queue = queue.then(() => processRender(jobId));
  };

  function createJob(data: JobData) {
    const jobId = randomUUID();

    queueRender({ jobId, data });

    return jobId;
  }

  return {
    createJob,
    jobs,
  };
};
