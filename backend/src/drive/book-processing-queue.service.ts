import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { BookProcessingService } from './book-processing.service';

type ImportJob = { userId: string; fileId: string; bookId: string };

@Injectable()
export class BookProcessingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = 'book-processing';
  private queue!: Queue<ImportJob>;
  private worker!: Worker<ImportJob>;

  constructor(private readonly processing: BookProcessingService) {}

  async onModuleInit() {
    const connection = this.redisConnection();
    this.queue = new Queue<ImportJob>(this.queueName, { connection });
    this.worker = new Worker<ImportJob>(
      this.queueName,
      (job) => this.processing.process(job.data.userId, job.data.fileId, job.data.bookId),
      { connection, concurrency: Number(process.env.BOOK_PROCESSING_CONCURRENCY ?? 1) },
    );
    this.worker.on('failed', (job, error) => {
      if (!job) return;
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= attempts) void this.processing.markFailed(job.data.bookId, error.message);
    });
    await Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()]);
  }

  async onModuleDestroy() {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async enqueueFromDrive(userId: string, fileId: string) {
    const book = await this.processing.prepareImport(userId, fileId);
    const jobId = `${userId}-${fileId}`;
    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (['active', 'delayed', 'prioritized', 'waiting', 'waiting-children'].includes(state)) return book;
      await existingJob.remove();
    }
    await this.queue.add('import-drive-file', { userId, fileId, bookId: book.id }, {
      jobId,
      attempts: Number(process.env.BOOK_PROCESSING_ATTEMPTS ?? 3),
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1_000 },
    });
    return book;
  }

  private redisConnection() {
    const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: Number(url.pathname.slice(1) || 0),
      maxRetriesPerRequest: null,
    };
  }
}
