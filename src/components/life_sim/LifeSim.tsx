import React, { useState, useEffect, useRef } from "react";

export const LifeSim = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [name, setName] = useState("life");
    const [width, setWidth] = useState(1000);
    const [height, setHeight] = useState(1000);
    const [m, setM] = useState<any>(null);

    // Setup Variables
    const [numOfParticleGroups, setNumOfParticleGroups] = useState<number>(0);
    const [particlesInitialised, setParticlesInitialised] = useState<boolean>(false);

    // Modularised variables
    const [particlesProxy, setParticlesProxy] = useState<any>([]);
    const [rulesProxy, setRulesProxy] = useState<any>([]);

    const randomiseRules = () => {
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
        setNumOfParticleGroups(8);
    }, []);

    const randomiseHexColors = (numOfColors: number): string[] => {
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
                let temp_numOfParticles = Math.floor(Math.random() * 1001); // Generate a random number between 0 and 200
                let temp_particleGroup = create(temp_numOfParticles, colors[i]);
                particleGroups.push(temp_particleGroup);
            }
            console.log("particleGroups", particleGroups);
            setParticlesProxy(particleGroups);
            setParticlesInitialised(true);
        }
    }, [numOfParticleGroups]);

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
        if (particlesInitialised) {
            console.log("started simulation");
            update();
        }
    }, [particlesInitialised]);

    const particle = (x:any, y:any, c:any) => {
        return {"x":x,"y":y, "vx":0, "vy":0, "color":c};
    }
    
    const random = () => {
        return Math.random()*((width+height)/2);
    }
    
    const create = (number:any, color:any) => {
        let group = [];
        for (let i = 0; i < number; i++) {
            group.push(particle(random(),random(),color));
        }
        return group;
    }

    // FIXME: Currently used for each particle draw aswell,
    //       should likely be handled with a batch-esc operation when the api call response is received 
    const draw = (x:any,y:any,c:any,s:any) => {
        m.fillStyle = c;
        m.fillRect(x,y,s,s);
    }

    async function update(particleGroups: any = particlesProxy) {
        const ENCODED_RULES = encodeEntity(rulesProxy, "rules");
        const ENCODED_PARTICLES = encodeEntity(particleGroups, "particles");

        const response = await triggerRulesAPI(ENCODED_PARTICLES, ENCODED_RULES);
        console.log("response", response);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const DATA = await response.text();

        const DECODED_PARTICLES = decodeEntity(DATA, "particles");
        console.log(DECODED_PARTICLES);
        // Clear canvas
        m.clearRect(0,0,width,height); // KEEP and use when response is received
        draw(0,0,"black", width); // KEEP and use when response is received
        // Render updated particles
        for (let i = 0; i < DECODED_PARTICLES.length; i++) {
            let proxy = DECODED_PARTICLES[i];

            for (let j = 0; j < proxy.length; j++) {
                let p = proxy[j];
                draw(p.x,p.y,p.color,3);
            }
        }
        // Queue next frame
        requestAnimationFrame(() => update(DECODED_PARTICLES));
    }

    // API call to backend to run rules more efficiently with rust
    async function triggerRulesAPI(ENCODED_PARTICLES: string, ENCODED_RULES: string) {
        return await fetch('http://127.0.0.1:8080/rules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rules: ENCODED_RULES, particles: ENCODED_PARTICLES })
        })
    }

    function encodeEntity(entity: any, tag: string): string {
        if (!entity) {
            return "";
        }

        if (tag === "rules") {
            let encoded = "";
            for (let i = 0; i < entity.length; i++) {
                let rule = entity[i];
                encoded += rule[0] + ":" + rule[1] + ":" + rule[2] + ",";
            }
            encoded.slice(0, -1); // Remove trailing comma
            return encoded;
        }
        
        // else it's particles
        let encoded = "";
        for (let i = 0; i < entity.length; i++) {
            let group = entity[i];
            for (let j = 0; j < group.length; j++) {
                let particle_obj = group[j];
                encoded += particle_obj.x + ":" + particle_obj.y + ":" + particle_obj.vx + ":" + particle_obj.vy + ":" + particle_obj.color + ",";
            }
            encoded.slice(0, -1); // Remove trailing comma
            encoded += "~";
        }
        encoded.slice(0, -1); // Remove trailing comma
        return encoded;
    }

    function decodeEntity(entity: string, tag: string): any {
        if (!entity) {
            return [];
        }

        if (tag === "rules") {
            let decoded = [];
            let rules = entity.split(",");
            for (let i = 0; i < rules.length; i++) {
                let rule = rules[i].split(":");
                decoded.push([rule[0], rule[1], rule[2]]); // [particleGroupOne, particleGroupTwo, gravity]
            }
            return decoded;
        }

        // else it's particles
        let decoded = [];
        let groups = entity.split("~");
        for (let i = 0; i < groups.length; i++) {
            let group = groups[i].split(",");
            let particle_group = [];
            for (let j = 0; j < group.length; j++) {
                let particle = group[j].split(":");
                particle_group.push({
                    x: parseInt(particle[0]),
                    y: parseInt(particle[1]),
                    vx: parseInt(particle[2]),
                    vy: parseInt(particle[3]),
                    color: particle[4]
                });
            }
            decoded.push(particle_group);
        }
        return decoded;
    }

    return (
        <canvas ref={canvasRef} id={name} width={width} height={height}></canvas>
    )
}