export interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    energy: number;
    spawned_child: boolean;
    consumes_id: number;
    loves_id: number;
}

export interface ParticleGroup {
    particles: Particle[];
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

export interface RuleChunk {
    rule: Rule;
}

export interface WorkerRuleChunk {
    changed_id: number,
    affecting_id: number,
    g: number,
    particle_group_one: ParticleGroup,
    particle_group_two: ParticleGroup,
}
