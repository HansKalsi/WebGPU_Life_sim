/// <reference lib="webworker" />
import { Particle, ParticleGroup, WorkerRuleChunk } from "../types/global_types.ts";

let width: number = 0;
let height: number = 0;

globalThis.onmessage = (e) => {
    const { action } = e.data;
    switch (action) {
        case "initialise":
            // setup worker with static data
            width = e.data.width;
            height = e.data.height;
            break;
        case "processChunk":
            const result = processChunk(e.data);
            globalThis.postMessage({ action: "chunkFinished", result });
            globalThis.postMessage({ action: "requestChunk" });
            break;
        case "noChunkReady":
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

function processChunk(data: WorkerRuleChunk): any {
    const { changed_id, affecting_id, g, particle_group_one, particle_group_two } = data;
    // console.time("worker execution time");
    let tempNewParticles: { id: number, o_id?: number, new_particles: ParticleGroup } = rule(changed_id, particle_group_one.particles, particle_group_two.particles, g);
    // console.timeEnd("worker execution time");
    tempNewParticles.o_id = affecting_id;
    return tempNewParticles;
}

function rule(pId: number, particles1: Particle[], particles2: Particle[], g: number): {id: number, new_particles: ParticleGroup} {
    let tempNewParticlesOne: ParticleGroup = { particles: [] };
    for (let i = 0; i < particles1.length; i++) {
        let fx = 0;
        let fy = 0;
        let a: Particle = particles1[i];
        let b: Particle;
        for (let j = 0; j < particles2.length; j++) {
            b = particles2[j];
            if (a.id === b.id) {
                // Don't check the particle against itself
                continue;
            }
            let dx = a.x-b.x;
            let dy = a.y-b.y;
            let d = Math.sqrt(dx*dx+dy*dy);
            if (d > 0 && d < 80) {
                let F = g * 1/d;
                fx += (F*dx);
                fy += (F*dy);
            }
            if (d > 0 && d < 5) {
                if (d < 0.1 && a.spawned_child === false) {
                    a.spawned_child = true;
                    let child: Particle;
                    if (Math.random() > 0.5) {
                        child = spawnChild(a);
                    } else {
                        child = spawnChild(b);
                    }
                    tempNewParticlesOne.particles?.push(child);
                }
                if (b.consumes_id > -1) {
                    if (b.consumes_id === a.id) {
                        b.energy += a.energy;
                        a.energy -= a.energy;
                        break; // no point in continuing to check other particles
                    }
                }
                if (a.loves_id === b.id) {
                    gainEnergy(a);
                }
            }
        }
        a.vx = (a.vx+fx)*0.4;
        a.vy = (a.vy+fy)*0.4;
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
        particleLifecycle(a);
        if (a.energy > 0) {
            tempNewParticlesOne.particles?.push(a);
        }
    }
    return {
        id: pId,
        new_particles: tempNewParticlesOne,
    };
}

function particleLifecycle(particle: Particle) {
    ageParticle(particle);
}

function ageParticle(particle: Particle) {
    particle.energy -= 1; // arbitrary amount of energy
}

function gainEnergy(particle: Particle) {
    particle.energy += 300; // arbitrary amount of energy
}

function spawnChild(particle: Particle) {
    // Lots of arbitray values here - key issue is that all arbitrary values in this file are affected by the amount of particle groups (since each particle is looped over more than once)
    const child: Particle = {
        id: particle.id,
        x: particle.x + (Math.random() * 10) - 5,
        y: particle.y + (Math.random() * 10) - 5,
        vx: particle.vx /2,
        vy: particle.vy /2,
        color: particle.color,
        energy: 1000,
        spawned_child: true, // so the child doesn't instantly spawn another child
        consumes_id: particle.consumes_id,
        loves_id: particle.loves_id,
    }
    return child;
}
