export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
}

export interface ParticleGroup {
    particles: Particle[] | null;
}

export interface Rule {
    particleGroupOne: number;
    particleGroupTwo: number;
    g: number;
}

export interface WorkerParticleGroup {
    id: number;
    // particle_groups: ParticleGroup[];
    // rules: Rule[];
    worker: Worker;
}
