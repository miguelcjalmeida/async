import {
  WorkerPool
, WorkerPoolFactory
, WorkerFactory
, WorkerPoolMessage
} from './async.d.ts'

interface QueueItem {
  (value: Worker) : void
}

interface WorkerCallback {
  (e: Event) : void
}

class WorkerPoolImpl implements WorkerPool {
  private workers: Array<Worker>
  private idles: Array<Worker>
  private queue: Array<QueueItem>

  constructor(private factory: WorkerFactory, private size: number) {
    this.workers = []
    this.idles = []
    this.queue = []
  }

  postMessage(message: WorkerPoolMessage, cancellation: Promise<any>) :
  Promise<any> {
    return this.getWorker()
    .then(worker =>
      new Promise((resolve, reject) => {
        worker.onmessage = this.handler(worker, resolve)
        worker.onerror = this.handler(worker, reject)
        worker.postMessage(message)
        cancellation.then(this.handler(worker, () => worker.terminate()))
      }))
  }

  killAll() : void {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.idles = []
  }

  private getWorker() : Promise<Worker> {
    var worker = this.idles.pop()

    if (worker) return Promise.resolve(worker)

    if (this.workers.length < this.size) {
      worker = this.factory()
      this.workers.push(worker)
      return Promise.resolve(worker)
    }

    return new Promise(resolve => this.queue.push(resolve))
  }

  private handler(worker: Worker, callback: WorkerCallback) : WorkerCallback {
    return (e: Event) => {
      worker.onmessage = null
      worker.onerror = null

      callback(e)

      if (this.queue.length) {
        let notify = this.queue.pop()
        return notify(worker)
      }

      this.idles.push(worker)
    }
  }
}

export default function (workerFactory: WorkerFactory) : WorkerPoolFactory {
  return function (size: number) : WorkerPool {
    return new WorkerPoolImpl(workerFactory, size)
  }
}
