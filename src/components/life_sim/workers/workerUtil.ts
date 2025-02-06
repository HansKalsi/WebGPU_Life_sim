import { rule } from "../LifeSim.tsx";

export function workerFunction(this: DedicatedWorkerGlobalScope) {
    this.onmessage = function(event: any) {
        // done processing worker logic
        this.postMessage(event.data);
    }
}

export function setupWorker(worker: Worker, completeFunction?: Function) {
    worker.onmessage = (event) => {
        if (event.data?.action === "triggerRule") {
            const { pId, width, height, particles1, particles2, g } = event.data;
            if (completeFunction) {
                completeFunction(rule(pId, width, height, particles1.group, particles2.group, g));
            }
        }

        if (event.data?.action === "triggerRules") {
            const { width, height, rules, particles } = event.data;
            let tempNewParticles: any = [];
            for (let i = 0; i < rules.length; i++) {
                const r = rules[i];
                const pId = r[0];
                // console.log(pId, particles);
                const particles1 = particles[pId];
                const particles2 = particles[r[1]];
                const g = r[2];

                tempNewParticles.push(rule(pId, width, height, particles1, particles2, g));
            }
            if (completeFunction) {
                completeFunction(tempNewParticles);
            }
        }
    };
    worker.onerror = (error) => {
        console.error(error.message);
    }
    // useful for killing unneeded workers
    // worker.terminate();
}
