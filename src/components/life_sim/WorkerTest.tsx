/// <reference lib="webworker" />
import { useEffect, useRef, useState } from "react";
import { setupWorker, workerFunction } from "./workers/workerUtil.ts";

export function WorkerTest() {
    const [workers, setWorkers] = useState<any>([]);
    const [results, setResults] = useState<any>([]);
    const [processing, setProcessing] = useState<boolean>(false);
    const dataFromWorkers = useRef<any>([]);

    useEffect(() => {
        let tempWorkers: any[] = [];
        const code = workerFunction.toString();
        const blob = new Blob([`(${code})()`], { type: "application/javascript" });
        const workerScriptUrl = URL.createObjectURL(blob);
        for (let i = 0; i < 5; i++) {
            const newWorker = new Worker(workerScriptUrl);
            setupWorker(newWorker, dataFromWorkers, triggerThisTest);
            tempWorkers.push(newWorker);
        }
        setWorkers(tempWorkers);
    }, []);
    
    function triggerThisTest() {
        console.log(dataFromWorkers.current);
    }

    useEffect(() => {
        console.log(workers);
        workers.forEach((worker: Worker) => {
            worker.postMessage('from main thread: message to worker');
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