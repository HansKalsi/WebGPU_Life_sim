/// <reference lib="webworker" />
import { Particle, ParticleGroup, Rule } from "../types/global_types.ts";

let width: number = 0;
let height: number = 0;
let rules: Rule[] = [];

globalThis.onmessage = (e) => {
    const { action } = e.data;
    switch (action) {
        case "initialise":
            // setup worker with static data
            width = e.data.width;
            height = e.data.height;
            rules = e.data.rules;
            globalThis.postMessage({ action: "requestChunk" });
            break;
        case "processChunk":
            const result = processChunk(e.data.particles);
            globalThis.postMessage({ action: "chunkFinished", result });
            globalThis.postMessage({ action: "requestChunk" });
            break;
        default:
            console.error("Unknown action", action);
            break;
    }
}

globalThis.onerror = (error) => {
    console.error(error);
}

function processChunk(particles: ParticleGroup[]): any {
    if (particles.length === 0) {
        console.error("No particles to process");
        return;
    }
    // console.time("worker execution time");
    let tempNewParticles: { id: number, new_particles: ParticleGroup }[] = [];
    for (let i = 0; i < rules.length; i++) {
        const r: Rule = rules[i];
        const pId = r.particleGroupOne;
        // console.log(pId, particles);
        const particles1: Particle[] = particles[pId].particles!;
        const particles2: Particle[] = particles[r.particleGroupTwo].particles!;
        const g = r.g;
        
        tempNewParticles.push(rule(pId, width, height, particles1, particles2, g));
    }
    // console.timeEnd("worker execution time");
    return tempNewParticles;
}

function rule(pId: number, width: number, height: number, particles1: Particle[], particles2: Particle[], g: number): {id: number, new_particles: ParticleGroup} {
    let tempNewParticlesOne: ParticleGroup = { particles: [] };
    for (let i = 0; i < particles1.length; i++) {
        let fx = 0;
        let fy = 0;
        let a: Particle = particles1[i];
        let b: Particle;
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
        tempNewParticlesOne.particles?.push(a);
    }
    return {
        id: pId,
        new_particles: tempNewParticlesOne,
    };
}
