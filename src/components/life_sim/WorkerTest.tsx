/// <reference lib="webworker" />
import { useEffect, useRef, useState } from "react";

export function WorkerTest() {
    const [workers, setWorkers] = useState<any>([]);
    const [results, setResults] = useState<any>([]);
    const [processing, setProcessing] = useState<boolean>(false);
    const dataFromWorkers = useRef<any>([]);

    function workerFunction(this: DedicatedWorkerGlobalScope) {
        this.onmessage = function(event: any) {
            // done processing worker logic
            this.postMessage('message from worker');
        }
    }

    useEffect(() => {
        let tempWorkers: any[] = [];
        for (let i = 0; i < 5; i++) {
            const code = workerFunction.toString();
            const blob = new Blob([`(${code})()`], { type: "application/javascript" });
            const workerScriptUrl = URL.createObjectURL(blob);
            const newWorker = new Worker(workerScriptUrl);
            setupWorker(newWorker);
            tempWorkers.push(newWorker);
        }
        setWorkers(tempWorkers);
    }, []);

    // TODO: make a worker util file
    function setupWorker(worker: Worker) {
        worker.onmessage = (event) => {
            console.log(event.data);
            // dataFromWorkers.current.push(event.data);
            // worker.postMessage(`data: ${event.data}`);
        };
        worker.onerror = (error) => {
            console.error(error.message);
        }
        // useful for killing unneeded workers
        // worker.terminate();
        worker.addEventListener('message', (event) => {
            dataFromWorkers.current.push(event.data);
            triggerThisTest();
        });
    }
    
    function triggerThisTest() {
        console.log(dataFromWorkers.current);
    }

    useEffect(() => {
        console.log(workers);
        workers.forEach((worker: Worker) => {
            // worker.addEventListener('message', (event) => {
            //     console.log(event.data);
            // });
            worker.postMessage('message from main thread');
        });
    }, [workers]);

    if (processing) return <div>Processing...</div>;
    
    return (
        <div>
            {results.map((result: any, index: number) => {
                return <p key={index}>{result} {index}</p>
            })}
        </div>
    )
}