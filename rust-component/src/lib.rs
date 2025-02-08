use wasm_bindgen::prelude::*;
// use wasm_bindgen::prelude::*;

const WIDTH: f32 = 1000.0;
const HEIGHT: f32 = 1000.0;

// #[wasm_bindgen]
pub fn trigger_particle_rules(encoded_rules: &String, encoded_particles: &String) -> String {
    let particles_arr: Vec<&str> = encoded_particles.split("~").collect();
    let num_particles = particles_arr.len();

    // Parse rules and group them by target particle group (r_id_one)
    let mut rules_by_particle_group: HashMap<usize, Vec<(usize, f32)>> = HashMap::new();

    for rule in encoded_rules.split(",") {
        let proxy: Vec<f32> = rule
            .split(":")
            .filter_map(|s| s.parse::<f32>().ok())
            .collect();
        if proxy.len() < 3 {
            continue;
        }
        let r_id_one = proxy[0] as usize;
        let r_id_two = proxy[1] as usize;
        let gravity_force = proxy[2];
        rules_by_particle_group
            .entry(r_id_one)
            .or_insert_with(Vec::new)
            .push((r_id_two, gravity_force));
    }

    // Process particle groups in parallel
    let updated_particle_groups: Vec<String> = particles_arr
        .par_iter()
        .enumerate()
        .map(|(idx, &p_one)| {
            // Check if there are any rules for this particle group
            if let Some(rules) = rules_by_particle_group.get(&idx) {
                let mut updated_p_one = p_one.to_string();

                // Process all rules for this particle
                for &(r_id_two, gravity_force) in rules {
                    if r_id_two >= num_particles {
                        continue;
                    }
                    let p_two = particles_arr[r_id_two];
                    if let Some(new_p_one) = trigger_rule(&updated_p_one, p_two, gravity_force) {
                        updated_p_one = new_p_one;
                    }
                }
                updated_p_one
            } else {
                // No updates, return the original particle group
                p_one.to_string()
            }
        })
        .collect();

    return updated_particle_groups.join("~");
}

fn trigger_rule(particles_one: &str, particles_two: &str, g: f32) -> Option<String> {
    let p_one: Vec<&str> = particles_one.split(",").collect();
    let p_two: Vec<&str> = particles_two.split(",").collect();
    let mut new_p_one: Vec<String> = vec![];
    
    for particle in p_one.iter() {
        let a: Vec<&str> = particle.split(":").collect();
        if a.len() < 4 {
            // new_p_one.push(particle.to_string());
            continue;
        }
        let mut ax: f32 = a[0].parse().unwrap();
        let mut ay: f32 = a[1].parse().unwrap();
        let mut fx = 0.0;
        let mut fy = 0.0;
        for other_particle in p_two.iter() {
            let b: Vec<&str> = other_particle.split(":").collect();
            if b.len() < 4 {
                continue;
            }
            let bx: f32 = b[0].parse().unwrap();
            let by: f32 = b[1].parse().unwrap();
                
            let dx = ax - bx; // a.x - b.x
            let dy = ay - by; // a.y - b.y
            let d = (dx * dx + dy * dy).sqrt();
            if d > 0.0 && d < 80.0 {
                let force: f32 = (g) * 1.0/d; // supposed to wrap the 1.0/d???
                fx = force * dx;
                fy = force * dy;
            } else {
                continue;
            }
        }

        let mut avx: f32 = (a[2].parse::<f32>().unwrap() + fx) * 0.5; // a.vx = (a.vx + fx) * 0.5
        let mut avy: f32 = (a[3].parse::<f32>().unwrap() + fy) * 0.5; // a.vy = (a.vy + fy) * 0.5
        ax += avx; // a.x += a.vx
        ay += avy; // a.y += a.vy
        if ax <= 0.0 || ax >= WIDTH { // a.x <= 0 || a.x >= width
            avx *= -1.0; // a.vx *= -1
        }
        if ay <= 0.0 || ay >= HEIGHT { // a.y <= 0 || a.y >= height
            avy *= -1.0; // a.vy *= -1
        }
        let colour = a[4];

        new_p_one.push(format!("{:.2}:{:.2}:{:.2}:{:.2}:{}", ax, ay, avx, avy, colour));
    }

    // new_p_one.par_extend(p_one.par_iter().map(|p1| {
    //     let a: Vec<&str> = p1.split(":").collect();
    //     if a.len() < 4 {
    //         return p1.to_string();
    //     }
    //     let mut ax: f32 = a[0].parse().unwrap();
    //     let mut ay: f32 = a[1].parse().unwrap();

    //     // let comparison_now = Instant::now();
    //     let (fx, fy) = p_two.par_iter()
    //         .map(|p2| {
    //             let b: Vec<&str> = p2.split(":").collect();
    //             if b.len() < 4 {
    //                 return (0.0, 0.0);
    //             }
    //             let bx: f32 = b[0].parse().unwrap();
    //             let by: f32 = b[1].parse().unwrap();
                
    //             let dx = ax - bx; // a.x - b.x
    //             let dy = ay - by; // a.y - b.y
    //             let d = (dx * dx + dy * dy).sqrt();
    //             if d > 0.0 && d < 80.0 {
    //                 let force: f32 = (g) * 1.0/d; // supposed to wrap the 1.0/d???
    //                 (force * dx, force * dy)
    //             } else {
    //                 (0.0, 0.0)
    //             }
    //         })
    //         .reduce(|| (0.0, 0.0), |(fx1, fy1), (fx2, fy2)| (fx1 + fx2, fy1 + fy2));
    //     // let comparison_elapsed = comparison_now.elapsed();
    //     // println!("Elapsed for rule comparison: {:.2?}", comparison_elapsed);

    //     let mut avx: f32 = (a[2].parse::<f32>().unwrap() + fx) * 0.5; // a.vx = (a.vx + fx) * 0.5
    //     let mut avy: f32 = (a[3].parse::<f32>().unwrap() + fy) * 0.5; // a.vy = (a.vy + fy) * 0.5
    //     ax += avx; // a.x += a.vx
    //     ay += avy; // a.y += a.vy
    //     if ax <= 0.0 || ax >= WIDTH { // a.x <= 0 || a.x >= width
    //         avx *= -1.0; // a.vx *= -1
    //     }
    //     if ay <= 0.0 || ay >= HEIGHT { // a.y <= 0 || a.y >= height
    //         avy *= -1.0; // a.vy *= -1
    //     }
    //     let colour = a[4];

    //     // 51.01773 : 361.34738 : 0.97994196 : 0.5047621 : #0CC662
    //     format!("{:.2}:{:.2}:{:.2}:{:.2}:{}", ax, ay, avx, avy, colour)
    // }));
    return Some(new_p_one.join(","));
}
