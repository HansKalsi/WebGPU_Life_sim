import React, { useState, useEffect, useRef } from "react";
import { Particle, ParticleGroup, Rule, WorkerParticleGroup } from "./types/global_types.ts";

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
    const workerCompleteCount = useRef<number>(0);

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
        setNumOfParticleGroups(16); // only use multiples of 4 since they are being split evenly amongst 4 workers - FIXME: make this not a requirement
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
            let temp_numOfParticles = 500; // Generate a random number between 0 and 200
            let temp_particleGroup: ParticleGroup = create(temp_numOfParticles, colors[i]);
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
        const WORKER_COUNT = 4;
        console.log(`starting ${WORKER_COUNT} workers`);
        console.log(`could start a maximum of ${navigator.hardwareConcurrency} workers`);
        let tempWorkers: WorkerParticleGroup[] = [];

        const amountOfParticleGroupsForWorker = numOfParticleGroups / WORKER_COUNT;
        let initialIndexForPG = 0;
        for (let i = 0; i < WORKER_COUNT; i++) {
            const newWorker = new Worker(new URL('./workers/worker.ts', import.meta.url));
            // let tempWorkersPGs = particlesProxy.current.slice(initialIndexForPG, initialIndexForPG + amountOfParticleGroupsForWorker);
            let tempWorkerRules = (rulesProxy.current).filter((rule: Rule) => {
                if (rule.particleGroupOne >= initialIndexForPG && rule.particleGroupOne < initialIndexForPG + amountOfParticleGroupsForWorker) {
                    return rule;
                }
            });
            console.log("worker rules", tempWorkerRules);
            newWorker.postMessage({ action: "initialise", width, height, rules: tempWorkerRules });
            // Listen for data requests
            newWorker.onmessage = (e) => {
                if (e.data.action === "requestChunk") {
                    console.log("worker requesting chunk");
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

    function particle(x:any, y:any, c:any): Particle {
        return {"x":x,"y":y, "vx":0, "vy":0, "color":c};
    }
    
    function randomPos(size: number): number {
        return Math.random()*size;
    }
    
    function create(number:any, color:any): ParticleGroup {
        let group: ParticleGroup = { particles: [] };
        for (let i = 0; i < number; i++) {
            (group.particles!).push(particle(randomPos(width), randomPos(height), color));
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
        triggerRules();
    }

    function triggerRules() {
        for (let workerObj of workers.current) {
            const worker = workerObj.worker;
            const copyOfAllParticleGroups = JSON.parse(JSON.stringify(particlesProxy.current));
            worker.postMessage({
                action: "processChunk",
                particles: copyOfAllParticleGroups,
            });
        }
    }

    function workerComplete(data: any) {
        // TODO: Somehow when the worker finishes, detect which particle groups it updated and replace the data with the new data
        if (particlesProxy.current.length > 0) {
            for (const updateData of data) {
                particlesProxy.current[updateData.id].particles = updateData.new_particles.particles;
            }
        }
        workerCompleteCount.current += 1;
        if (workerCompleteCount.current === workers.current.length) {
            workerCompleteCount.current = 0;
            drawFrame();
        }
    }

    return (
        <canvas ref={canvasRef} id={name} width={width} height={height}></canvas>
    )
}
