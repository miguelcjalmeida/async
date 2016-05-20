import util from './util'
import createWorker from './create-worker'

var createWorkerSrc = util.source(createWorker) + '.call(this)'
var workerBlob = util.scriptBlob(createWorkerSrc)

interface QueueItem {
  (value: Worker) : void
}

interface WorkerCallback {
  (e: Event) : void
}

interface WorkerPoolMessage {
  action: string
  scope?: any
  args?: Array<any>
}

class WorkerPool {
  private workers: Array<Worker>
  private idles: Array<Worker>
  private queue: Array<QueueItem>

  constructor(private size: number) {
    this.workers = []
    this.idles = []
    this.queue = []
  }

  postMessage(message: WorkerPoolMessage, cancellation: Promise<any>) : Promise<any> {
    return this.getWorker()
    .then((worker) => {
      return new Promise((resolve, reject) => {
        worker.onmessage = this.handler(resolve)
        worker.onerror = this.handler(reject)
        worker.postMessage(message)
        cancellation.then(this.handler(() => worker.terminate()))
      })
    })
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
      worker = new Worker(workerBlob)
      this.workers.push(worker)
      return Promise.resolve(worker)
    }

    return new Promise(resolve => this.queue.push(resolve))
  }

  private handler(callback: WorkerCallback) : WorkerCallback {
    var self = this

    return function (e: Event) {
      this.onmessage = null
      this.onerror = null

      callback(e)

      if (self.queue.length) {
        var notify = self.queue.pop()
        return notify(this)
      }

      self.idles.push(this)
    }
  }
}

export default WorkerPool
