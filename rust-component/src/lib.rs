use std::vec;
use std::time::Instant;
use rayon::prelude::*;

// use wasm_bindgen::prelude::*;

const WIDTH: f32 = 1000.0;
const HEIGHT: f32 = 1000.0;

// #[wasm_bindgen]
pub fn trigger_particle_rules(encoded_rules: &String, encoded_particles: &String) -> String {
    let mut temp_updated_encoded_particles: Vec<String> = vec![];
    let particles_arr: Vec<&str> = encoded_particles.split("~").collect();
    // Loops through all rule objects
    for rule in encoded_rules.split(",") {
        // Represents a decoded rule object { particle_one_id, particle_two_id, gravity_force }
        let proxy: Vec<f32> = rule.split(":")
                        .filter_map(|s| s.parse::<f32>().ok())
                        .collect();
        if proxy.len() < 2 {
            continue;
        }
        let r_id_one: usize = proxy[0] as usize;
        let r_id_two: usize = proxy[1] as usize;
        if r_id_one >= particles_arr.len() || r_id_two >= particles_arr.len() {
            continue;
        }
        let mut p_one: &str = particles_arr[r_id_one];
        let mut p_two: &str = particles_arr[r_id_two];
        // If we have a r_id_one or r_id_two in the temp_updated_encoded_particles vector, we should use that encoded object instead of the original in particles_arr
        if (r_id_one) < temp_updated_encoded_particles.len() {
            p_one = &temp_updated_encoded_particles[r_id_one];
        }
        if (r_id_two) < temp_updated_encoded_particles.len() {
            p_two = &temp_updated_encoded_particles[r_id_two];
        }
        let rule_now = Instant::now();
        let rule_result = trigger_rule(
            p_one,
            p_two,
            proxy[2] as f32
        );
        let rule_elapsed = rule_now.elapsed();
        println!("Elapsed for rule iteration: {:.2?}", rule_elapsed);
        // Keep log of updated particle group for future usage if same particle group is needed again (so we can apply future rules to the updated version)
        if temp_updated_encoded_particles.len() as f32 == r_id_one as f32 {
            temp_updated_encoded_particles.push(rule_result);
        } else {
            temp_updated_encoded_particles[r_id_one] = rule_result;
        }
    }
    return temp_updated_encoded_particles.join("~");
}

fn trigger_rule(particles_one: &str, particles_two: &str, g: f32) -> String {
    let setup_now = Instant::now();
    let p_one: Vec<&str> = particles_one.split(",").collect();
    let p_two: Vec<&str> = particles_two.split(",").collect();
    let mut new_p_one: Vec<String> = vec![];
    let setup_elapsed = setup_now.elapsed();
    println!("Elapsed for rule setup: {:.2?}", setup_elapsed);
    
    new_p_one.par_extend(p_one.par_iter().map(|p1| {
        let a: Vec<&str> = p1.split(":").collect();
        if a.len() < 4 {
            return p1.to_string();
        }
        let mut ax: f32 = a[0].parse().unwrap();
        let mut ay: f32 = a[1].parse().unwrap();

        let comparison_now = Instant::now();
        let (fx, fy) = p_two.par_iter()
            .map(|p2| {
                let b: Vec<&str> = p2.split(":").collect();
                if b.len() < 4 {
                    return (0.0, 0.0);
                }
                let bx: f32 = b[0].parse().unwrap();
                let by: f32 = b[1].parse().unwrap();
                
                let dx = ax - bx; // a.x - b.x
                let dy = ay - by; // a.y - b.y
                let d = (dx * dx + dy * dy).sqrt();
                if d > 0.0 && d < 80.0 {
                    let force: f32 = (g) * 1.0/d; // supposed to wrap the 1.0/d???
                    (force * dx, force * dy)
                } else {
                    (0.0, 0.0)
                }
            })
            .reduce(|| (0.0, 0.0), |(fx1, fy1), (fx2, fy2)| (fx1 + fx2, fy1 + fy2));
        let comparison_elapsed = comparison_now.elapsed();
        println!("Elapsed for rule comparison: {:.2?}", comparison_elapsed);

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

        // 51.01773 : 361.34738 : 0.97994196 : 0.5047621 : #0CC662
        format!("{:.2}:{:.2}:{:.2}:{:.2}:{}", ax, ay, avx, avy, colour)
    }));
    return new_p_one.join(",");
}
