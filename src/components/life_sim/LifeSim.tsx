import React, { useState, useEffect, useRef } from "react";
import { Particle, ParticleGroup, Rule, RuleChunk, WorkerParticleGroup } from "./types/global_types.ts";

export function LifeSim() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [name, setName] = useState("life");
    const [width, setWidth] = useState(1000);
    const [height, setHeight] = useState(1000);
    const [m, setM] = useState<any>(null);

    // Setup variables
    const [numOfParticleGroups, setNumOfParticleGroups] = useState<number>(0);

    // Modularised variables
    const particlesProxy = useRef<ParticleGroup[]>([]);
    const rulesProxy = useRef<Rule[]>([]);
    const workers = useRef<WorkerParticleGroup[]>([]);

    // Tracker variables
    const ruleChunks = useRef<RuleChunk[]>([]);
    const particleGroupIdsBeingWorkedOn = useRef<number[]>([]);

    function randomiseRules(): Rule[] {
        let rules: Rule[] = [];
        // Iterate over each particle group and then iterate over each particle group again to get every possible rule pair
        for (let i = 0; i < numOfParticleGroups; i++) {
            const particleGroupOne = i;
            for (let j = 0; j < numOfParticleGroups; j++) {
                const particleGroupTwo = j;
                let gForce = Math.random()*2-1;
                let rule: Rule = {
                    particleGroupOne: particleGroupOne,
                    particleGroupTwo: particleGroupTwo,
                    g: gForce,
                };
                rules.push(rule);
            }
        }
        console.log("rules", rules);
        return rules;
    }

    useEffect(() => {
        setNumOfParticleGroups(12);
    }, []);

    function randomiseHexColors(numOfColors: number): string[] {
        const colors: string[] = [];
        const hexChars = "0123456789ABCDEF";

        while (colors.length < numOfColors) {
            let color = "#";
            for (let i = 0; i < 6; i++) {
                color += hexChars[Math.floor(Math.random() * 16)];
            }
            if (!colors.includes(color)) {
                colors.push(color);
            }
        }

        return colors;
    };

    useEffect(() => {
        if (numOfParticleGroups) {
            startSimulation();
        }
    }, [numOfParticleGroups]);

    function startSimulation() {
        // Setup rules
        rulesProxy.current = randomiseRules();
        // Setup particle groups
        const colors = randomiseHexColors(numOfParticleGroups);
        console.log("colours", colors);
        let particleGroups: ParticleGroup[] = [];
        for (let i = 0; i < colors.length; i++) {
            // TODO: Make random again (only fixed for testing consistently)
            // let temp_numOfParticles = Math.floor(Math.random() * 1001); // Generate a random number between 0 and 200
            let temp_numOfParticles = 100; // Generate a random number between 0 and 200
            let consumes_id = -1;
            // FIXME: Particle groups should not consume nor love themselves (to foster diverse organisms)
            if (Math.random() > 0.6) {
                consumes_id = Math.floor(Math.random() * numOfParticleGroups);
            }
            let loves_id = Math.floor(Math.random() * numOfParticleGroups);
            let temp_particleGroup: ParticleGroup = create(i, temp_numOfParticles, colors[i], consumes_id, loves_id);
            particleGroups.push(temp_particleGroup);
        }
        console.log("particleGroups", particleGroups);
        console.log("total number of particles:", particleGroups.reduce((acc, group) => acc + group.particles!.length, 0));
        particlesProxy.current = particleGroups;
        // Setup workers
        setupWorkers();
        // Start simulation
        console.log("started simulation", particlesProxy.current);
        drawFrame();
    }

    function setupWorkers() {
        // const WORKER_COUNT = navigator.hardwareConcurrency || 4;
        const WORKER_COUNT = 8;
        console.log(`starting ${WORKER_COUNT} workers`);
        console.log(`could start a maximum of ${navigator.hardwareConcurrency} workers`);
        let tempWorkers: WorkerParticleGroup[] = [];

        const amountOfParticleGroupsForWorker = numOfParticleGroups / WORKER_COUNT;
        let initialIndexForPG = 0;
        for (let i = 0; i < WORKER_COUNT; i++) {
            const newWorker = new Worker(new URL('./workers/worker.ts', import.meta.url));
            // let tempWorkersPGs = particlesProxy.current.slice(initialIndexForPG, initialIndexForPG + amountOfParticleGroupsForWorker);
            // console.log("worker rules", tempWorkerRules);
            // Listen for data requests
            newWorker.onmessage = (e) => {
                if (e.data.action === "requestChunk") {
                    // console.log("worker requesting chunk");
                    passNextRuleChunk(newWorker);
                } else if (e.data.action === "chunkFinished") {
                    workerComplete(e.data.result);
                }
            };
            let workerParticleGroup: WorkerParticleGroup = {
                id: i,
                // particle_groups: tempWorkersPGs,
                // rules: tempWorkerRules,
                worker: newWorker
            };
            console.log(workerParticleGroup);
            workerParticleGroup.worker.postMessage({ action: "initialise", width, height });
            tempWorkers.push(workerParticleGroup);
            console.log(tempWorkers);
            initialIndexForPG += amountOfParticleGroupsForWorker;
            console.log(initialIndexForPG);
        }
        workers.current = tempWorkers;
        console.log("workers created:", workers.current);
    }

    useEffect(() => {
        if (canvasRef.current) {
            if (!m) {
                setM(canvasRef.current?.getContext("2d"));
            }
        }
    }, [canvasRef]);

    function particle(id: number, x: number, y: number, c: string, consumes_id: number, loves_id: number): Particle {
        return { id: id, x: x, y: y, vx: 0, vy: 0, color: c, energy: (100 * numOfParticleGroups), spawned_child: false, consumes_id: consumes_id, loves_id: loves_id };
    }

    function randomPos(size: number): number {
        return Math.random()*size;
    }
    
    function create(group_id: number, number:any, color:any, consumes_id: number, loves_id: number): ParticleGroup {
        let group: ParticleGroup = { particles: [] };
        for (let i = 0; i < number; i++) {
            (group.particles).push(particle(group_id, randomPos(width), randomPos(height), color, consumes_id, loves_id));
        }
        return group;
    }

    function draw(x:any,y:any,c:any,s:any) {
        m.fillStyle = c;
        m.fillRect(x,y,s,s);
    }

    function drawFrame() {
        // console.timeEnd("drawFrame");
        // console.time("drawFrame");
        console.log("drawing frame, total particles: ", particlesProxy.current.reduce((acc, group) => acc + group.particles!.length, 0));
        // Reset canvas (so old data is removed and colour bleeding doesn't happen)
        m.clearRect(0,0,width,height);
        // TODO: worker-ise
        for (let proxy of particlesProxy.current) {
            if (!proxy?.particles) {
                continue;
            }
            // console.log(proxy);
            for (let particle of proxy.particles) {
                draw(particle.x, particle.y, particle.color, 3);
            }
        }
        // Kick off the next frame
        update();
    }

    function update() {
        setupNextFrameRuleChunks();
        triggerRules();
        resetParticleAttributes();
    }

    function resetParticleAttributes() {
        for (let proxy of particlesProxy.current) {
            for (let particle of proxy.particles) {
                particle.spawned_child = false;
            }
        }
    }

    function triggerRules() {
        for (let workerObj of workers.current) {
            passNextRuleChunk(workerObj.worker);
        }
    }

    function workerComplete(data: any) {
        // TODO: Somehow when the worker finishes, detect which particle groups it updated and replace the data with the new data
        if (particlesProxy.current.length > 0) {
            particlesProxy.current[data.id].particles = data.new_particles.particles;
            particleGroupIdsBeingWorkedOn.current = particleGroupIdsBeingWorkedOn.current.filter((id) => id !== data.id && id !== data.o_id);
        }
        if (ruleChunks.current.length === 0) {
            // console.log("frame drawn");
            drawFrame();
        }
    }

    function setupNextFrameRuleChunks() {
        for (const rule of rulesProxy.current) {
            const ruleChunk: RuleChunk = {
                rule: rule,
            }
            ruleChunks.current.push(ruleChunk);
        }
    }

    function passNextRuleChunk(worker: Worker) {
        // console.log("passing next rule chunk of chunks", ruleChunks.current.length);
        if (ruleChunks.current.length > 0) {
            let nextIndexToProcess = findNextUnworkedParticleGroupRule(ruleChunks.current.length - 1);
            if (nextIndexToProcess >= 0) {
                const ruleChunk = ruleChunks.current[nextIndexToProcess];
                ruleChunks.current.splice(nextIndexToProcess, 1);
                const rule = ruleChunk.rule;
                worker.postMessage({
                    action: "processChunk",
                    changed_id: rule.particleGroupOne,
                    affecting_id: rule.particleGroupTwo,
                    g: rule.g,
                    particle_group_one: particlesProxy.current[rule.particleGroupOne],
                    particle_group_two: particlesProxy.current[rule.particleGroupTwo],
                });
            } else {
                worker.postMessage({ action: "noChunkReady" });
            }
        } else {
            // TODO: Terminate worker (since no more work to do)
        }
    }

    function findNextUnworkedParticleGroupRule(checkNext: number): number {
        if (checkNext < 0) {
            return -1;
        }
        let checkIds = ruleChunks.current[checkNext].rule;
        if (particleGroupIdsBeingWorkedOn.current.includes(checkIds.particleGroupOne) || particleGroupIdsBeingWorkedOn.current.includes(checkIds.particleGroupTwo)) {
            return findNextUnworkedParticleGroupRule(checkNext - 1);
        }
        particleGroupIdsBeingWorkedOn.current.push(checkIds.particleGroupOne);
        particleGroupIdsBeingWorkedOn.current.push(checkIds.particleGroupTwo);
        return checkNext;

    }

    return (
        <canvas ref={canvasRef} id={name} width={width} height={height}></canvas>
    )
}
