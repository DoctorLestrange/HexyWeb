import { calculateBlobHash, formatHashError } from '../utils/hashEngine';
import type { HashAlgorithm } from '../utils/hashUtils';

export interface HashWorkerStartMessage {
  type: 'start';
  jobId: number;
  file: File;
  algorithms: HashAlgorithm[];
  expectedHex: string | null;
}

export interface HashWorkerCancelMessage {
  type: 'cancel';
  jobId: number;
}

export type HashWorkerInbound = HashWorkerStartMessage | HashWorkerCancelMessage;

export interface HashWorkerProgressEvent {
  type: 'progress';
  jobId: number;
  algorithm: HashAlgorithm;
  percent: number;
  bytesRead: number;
  totalBytes: number;
}

export interface HashWorkerDoneEvent {
  type: 'done';
  jobId: number;
  matched: boolean;
  matchedAlgo: HashAlgorithm | null;
  lastAlgo: HashAlgorithm | null;
  displayHash: string;
}

export interface HashWorkerCancelledEvent {
  type: 'cancelled';
  jobId: number;
}

export interface HashWorkerErrorEvent {
  type: 'error';
  jobId: number;
  message: string;
}

export type HashWorkerOutbound =
  | HashWorkerProgressEvent
  | HashWorkerDoneEvent
  | HashWorkerCancelledEvent
  | HashWorkerErrorEvent;

let activeJobId = 0;
let cancelledJobId = -1;

self.onmessage = async (event: MessageEvent<HashWorkerInbound>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelledJobId = msg.jobId;
    return;
  }

  if (msg.type === 'start') {
    activeJobId = msg.jobId;
    const isCancelled = () => cancelledJobId === msg.jobId || activeJobId !== msg.jobId;

    try {
      let lastAlgo: HashAlgorithm | null = null;
      let lastHash = '';

      for (const algo of msg.algorithms) {
        if (isCancelled()) {
          self.postMessage({ type: 'cancelled', jobId: msg.jobId } satisfies HashWorkerCancelledEvent);
          return;
        }

        self.postMessage({
          type: 'progress',
          jobId: msg.jobId,
          algorithm: algo,
          percent: 0,
          bytesRead: 0,
          totalBytes: msg.file.size,
        } satisfies HashWorkerProgressEvent);

        const hashResult = await calculateBlobHash(
          msg.file,
          algo,
          isCancelled,
          (bytesRead, totalBytes, percent) => {
            if (!isCancelled()) {
              self.postMessage({
                type: 'progress',
                jobId: msg.jobId,
                algorithm: algo,
                percent,
                bytesRead,
                totalBytes,
              } satisfies HashWorkerProgressEvent);
            }
          }
        );

        if (isCancelled() || hashResult === null) {
          self.postMessage({ type: 'cancelled', jobId: msg.jobId } satisfies HashWorkerCancelledEvent);
          return;
        }

        lastAlgo = algo;
        lastHash = hashResult;

        if (msg.expectedHex && msg.expectedHex.toLowerCase() === hashResult.toLowerCase()) {
          self.postMessage({
            type: 'done',
            jobId: msg.jobId,
            matched: true,
            matchedAlgo: algo,
            lastAlgo: algo,
            displayHash: hashResult,
          } satisfies HashWorkerDoneEvent);
          return;
        }
      }

      self.postMessage({
        type: 'done',
        jobId: msg.jobId,
        matched: false,
        matchedAlgo: null,
        lastAlgo,
        displayHash: lastHash,
      } satisfies HashWorkerDoneEvent);
    } catch (err) {
      self.postMessage({
        type: 'error',
        jobId: msg.jobId,
        message: formatHashError(err),
      } satisfies HashWorkerErrorEvent);
    }
  }
};
