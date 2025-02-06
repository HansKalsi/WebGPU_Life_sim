import React, { useState, useEffect, useRef } from "react";
import { setupWorker, workerFunction } from "./workers/workerUtil.ts";

export function LifeSim() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [name, setName] = useState("life");
    const [width, setWidth] = useState(1000);
    const [height, setHeight] = useState(1000);
    const [m, setM] = useState<any>(null);

    // Setup Variables
    const [numOfParticleGroups, setNumOfParticleGroups] = useState<number>(0);

    // Modularised variables
    // TODO: split evenly amongst workers and have workers always process specific groups and their associated rules
    const particlesProxy = useRef<any>([]);
    const [rulesProxy, setRulesProxy] = useState<any>([]);

    // testing
    // const [workers, setWorkers] = useState<Worker[]>([]);
    const workers = useRef<any>([]);

    function randomiseRules() {
        let rules = [];
        // Iterate over each particle group and then iterate over each particle group again to get every possible rule pair
        for (let i = 0; i < numOfParticleGroups; i++) {
            const particleGroupOne = i;
            for (let j = 0; j < numOfParticleGroups; j++) {
                const particleGroupTwo = j;
                let rule = [];
                let g = Math.random()*2-1;
                rule.push(particleGroupOne);
                rule.push(particleGroupTwo);
                rule.push(g);
                rules.push(rule);
            }
        }
        console.log("rules", rules);
        return rules;
    }

    useEffect(() => {
        setNumOfParticleGroups(25);
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
            const colors = randomiseHexColors(numOfParticleGroups);
            console.log("colours", colors);
            let particleGroups = [];
            for (let i = 0; i < colors.length; i++) {
                // let temp_numOfParticles = Math.floor(Math.random() * 1001); // Generate a random number between 0 and 200
                let temp_numOfParticles = 500; // Generate a random number between 0 and 200
                let temp_particleGroup = create(temp_numOfParticles, colors[i]);
                particleGroups.push(temp_particleGroup);
            }
            console.log("particleGroups", particleGroups);
            console.log("total number of particles:", particleGroups.reduce((acc, group) => acc + group.length, 0));
            particlesProxy.current = particleGroups;

            setupWorkers();
        }
    }, [numOfParticleGroups]);

    function setupWorkers() {
        // const WORKER_COUNT = navigator.hardwareConcurrency || 4;
        const WORKER_COUNT = 4;
        console.log(`starting ${WORKER_COUNT} workers`);
        console.log(`could start a maximum of ${navigator.hardwareConcurrency} workers`);
        let tempWorkers: Worker[] = [];

        const code = workerFunction.toString();
        const blob = new Blob([`(${code})()`], { type: "application/javascript" });
        const workerScriptUrl = URL.createObjectURL(blob);
        for (let i = 0; i < WORKER_COUNT; i++) {
            const newWorker = new Worker(workerScriptUrl);
            setupWorker(newWorker, workerComplete);
            tempWorkers.push(newWorker);
        }
        workers.current = tempWorkers;
    }

    useEffect(() => {
        if (workers.current.length > 0) {
            console.log("workers setup", workers.current);
            (workers.current).forEach((worker: Worker) => {
                worker.postMessage('from main thread: message to worker');
            });
        }
    }, [workers.current]);

    useEffect(() => {
        if (canvasRef.current) {
            if (!m) {
                setM(canvasRef.current?.getContext("2d"));
            }
        }
    }, [canvasRef]);

    useEffect(() => {
        if (m) {
            setRulesProxy(randomiseRules());
        }
    }, [m])

    useEffect(() => {
        if (particlesProxy.current.length > 0) {
            console.log("started simulation", particlesProxy.current);
            update();
        }
    }, [particlesProxy.current]);

    function particle(x:any, y:any, c:any) {
        return {"x":x,"y":y, "vx":0, "vy":0, "color":c};
    }
    
    function randomPos(size: number) {
        return Math.random()*size;
    }
    
    function create(number:any, color:any) {
        let group = [];
        for (let i = 0; i < number; i++) {
            group.push(particle(randomPos(width), randomPos(height), color));
        }
        return group;
    }

    function draw(x:any,y:any,c:any,s:any) {
        m.fillStyle = c;
        m.fillRect(x,y,s,s);
    }

    function update() {
        triggerRules();
        m.clearRect(0,0,width,height);
        // Reset canvas (so old data is removed and colour bleeding doesn't happen)
        draw(0,0,"black", width);
        // TODO: worker-ise
        for (let i = 0; i < numOfParticleGroups; i++) {
            let proxy = particlesProxy.current[i];
            for (let i = 0; i < proxy.length; i++) {
                let p = proxy[i];
                draw(p.x,p.y,p.color,3);
            }
        }
        requestAnimationFrame(update);
    }

    function triggerRules() {
        let workerIndex = 0;
        const dividedRulesWorkload = rulesProxy.length / workers.current.length;
        for (let i = 0; i < rulesProxy.length; i += dividedRulesWorkload) {
            const rulesBatch = rulesProxy.slice(i, i + dividedRulesWorkload);
            const worker = workers.current[workerIndex];

            worker.postMessage({
                action: "triggerRules",
                width: width,
                height: height,
                rules: rulesBatch,
                particles: particlesProxy.current
            });

            workerIndex++;
            // // FIXME: Because rules are in order, and the same particle group is affected multiple times, this method of splitting the rules between workers will likely cause some data loss
            // for (let j = 0; j < workers.length; j++) {
            //     if (i+j >= rulesProxy.length) {
            //         break;
            //     }
            //     let worker = workers[j];
            //     const proxy = rulesProxy[i+j];
            //     worker.postMessage({
            //         action: "triggerRule",
            //         pId: proxy[0],
            //         width: width,
            //         height: height,
            //         particles1: { group: particlesProxy.current[proxy[0]] },
            //         particles2: { group: particlesProxy.current[proxy[1]] },
            //         g: proxy[2]
            //     });
            // }
        }
    }

    function workerComplete(data: any) {
        if (particlesProxy.current.length > 0) {
            for (const particleGroup of data) {
                particlesProxy.current[particleGroup.id] = particleGroup.newParticles;
            }
        }
    }

    return (
        <canvas ref={canvasRef} id={name} width={width} height={height}></canvas>
    )
}

export function rule(pId: any, width: any, height: any, particles1:any, particles2:any, g:any) {
    let tempNewParticlesOne = [];
    // console.log("og particles:", particles1[0].x);
    for (let i = 0; i < particles1.length; i++) {
        let fx = 0;
        let fy = 0;
        let a:any = particles1[i];
        let b:any;
        for (let j = 0; j < particles2.length; j++) {
            b = particles2[j];
            let dx = a.x-b.x;
            let dy = a.y-b.y;
            let d = Math.sqrt(dx*dx+dy*dy);
            if (d > 0 && d < 80) {
                let F = g * 1/d;
                fx += (F*dx);
                fy += (F*dy);
            }
        }
        a.vx = (a.vx+fx)*0.2;
        a.vy = (a.vy+fy)*0.2;
        // If the particle would go off screen, make it's force change negative
        if ((a.x + a.vx) <= 0 || (a.x + a.vx) >= width) {
            a.vx *= -1;
        }
        if ((a.y + a.vy) <= 0 || (a.y + a.vy) >= height) {
            a.vy *= -1;
        }
        // Apply the force change to the particles position
        a.x += a.vx;
        a.y += a.vy;
        tempNewParticlesOne.push(a);
    }
    // console.log("new particles:", tempNewParticlesOne[0].x);
    return {
        id: pId,
        newParticles: tempNewParticlesOne,
    };
}
