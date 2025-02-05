import React, { useState, useEffect, useRef } from "react";

export const LifeSim = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [name, setName] = useState("life");
    const [width, setWidth] = useState(1000);
    const [height, setHeight] = useState(1000);
    const [m, setM] = useState<any>(null);

    // Setup Variables
    const [numOfParticleGroups, setNumOfParticleGroups] = useState<number>(0);

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
        setNumOfParticleGroups(10);
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
            console.log("total number of particles:", particleGroups.reduce((acc, group) => acc + group.length, 0));
            setParticlesProxy(particleGroups);
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
        if (particlesProxy.length > 0) {
            console.log("started simulation");
            update();
        }
    }, [particlesProxy]);

    function particle(x:any, y:any, c:any) {
        return {"x":x,"y":y, "vx":0, "vy":0, "color":c};
    }
    
    function randomPos(size: number) {
        return Math.random()*size;
    }
    
    const create = (number:any, color:any) => {
        let group = [];
        for (let i = 0; i < number; i++) {
            group.push(particle(randomPos(width), randomPos(height), color));
        }
        return group;
    }

    const draw = (x:any,y:any,c:any,s:any) => {
        m.fillStyle = c;
        m.fillRect(x,y,s,s);
    }

    const rule = (particles1:any, particles2:any, g:any) => {
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
        }
    }

    const update = () => {
        triggerRules();
        m.clearRect(0,0,width,height);
        draw(0,0,"black", width);
        for (let i = 0; i < particlesProxy.length; i++) {
            let proxy = particlesProxy[i];

            for (let i = 0; i < proxy.length; i++) {
                let p = proxy[i];
                draw(p.x,p.y,p.color,3);
            }
        }
        requestAnimationFrame(update);
    }

    const triggerRules = () => {
        for (let i = 0; i < rulesProxy.length; i++) {
            let proxy = rulesProxy[i];
            rule(particlesProxy[proxy[0]], particlesProxy[proxy[1]], proxy[2]);
        }
    }

    return (
        <canvas ref={canvasRef} id={name} width={width} height={height}></canvas>
    )
}