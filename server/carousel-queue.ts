import { renderStill, selectComposition } from "@remotion/renderer";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface SlideInput {
  role: "portada" | "contenido" | "cierre";
  eyebrow?: string;
  hook?: string;
  titulo?: string;
  texto?: string;
  ctaText?: string;
  photoUrl?: string;
}

interface JobData {
  slides: SlideInput[];
  backgroundUrl: string;
  logoUrl: string;
}

type JobState =
  | {
      status: "queued";
      data: JobData;
    }
  | {
      status: "in-progress";
      progress: number;
      data: JobData;
    }
  | {
      status: "completed";
      pdfUrl: string;
      data: JobData;
    }
  | {
      status: "failed";
      message: string;
      data: JobData;
    };

const compositionId = "CarouselSlide";

export const makeCarouselQueue = ({
  serveUrl,
  carouselsDir,
  publicBaseUrl,
}: {
  serveUrl: string;
  carouselsDir: string;
  publicBaseUrl: string;
}) => {
  const jobs = new Map<string, JobState>();
  let queue: Promise<unknown> = Promise.resolve();

  const processCarousel = async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) {
      throw new Error(`Carousel job ${jobId} not found`);
    }

    jobs.set(jobId, { status: "in-progress", progress: 0, data: job.data });

    // Cada slide se renderiza a un PNG temporal (renderStill, no renderMedia
    // -- es una imagen fija) y se va agregando como pagina a un PDF con
    // pdf-lib. Un "carrusel" de LinkedIn es en realidad un post de tipo
    // documento: un unico PDF que LinkedIn pagina como diapositivas.
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `carousel-${jobId}-`),
    );

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < job.data.slides.length; i++) {
        const slide = job.data.slides[i];

        const inputProps = {
          ...slide,
          backgroundUrl: job.data.backgroundUrl,
          logoUrl: job.data.logoUrl,
        };

        const composition = await selectComposition({
          serveUrl,
          id: compositionId,
          inputProps,
        });

        const stillPath = path.join(tmpDir, `slide-${i}.png`);

        await renderStill({
          serveUrl,
          composition,
          inputProps,
          output: stillPath,
        });

        const pngBytes = await fs.readFile(stillPath);
        const pngImage = await pdfDoc.embedPng(pngBytes);
        const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pngImage.width,
          height: pngImage.height,
        });

        jobs.set(jobId, {
          status: "in-progress",
          progress: (i + 1) / job.data.slides.length,
          data: job.data,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const pdfPath = path.join(carouselsDir, `${jobId}.pdf`);
      await fs.writeFile(pdfPath, pdfBytes);

      jobs.set(jobId, {
        status: "completed",
        pdfUrl: `${publicBaseUrl}/carousels/${jobId}.pdf`,
        data: job.data,
      });
    } catch (error) {
      console.error(error);
      jobs.set(jobId, {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        data: job.data,
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  };

  const queueCarousel = async ({
    jobId,
    data,
  }: {
    jobId: string;
    data: JobData;
  }) => {
    jobs.set(jobId, { status: "queued", data });

    queue = queue.then(() => processCarousel(jobId));
  };

  function createJob(data: JobData) {
    const jobId = randomUUID();

    queueCarousel({ jobId, data });

    return jobId;
  }

  return {
    createJob,
    jobs,
  };
};
