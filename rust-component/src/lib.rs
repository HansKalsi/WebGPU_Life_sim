use std::vec;

// use wasm_bindgen::prelude::*;

const WIDTH: f32 = 1000.0;
const HEIGHT: f32 = 1000.0;

// #[wasm_bindgen]
pub fn trigger_particle_rules(encoded_rules: &String, encoded_particles: &String) -> String {
    let mut temp_updated_encoded_particles: Vec<String> = vec![];
    let particles_arr: Vec<String> = encoded_particles.split("~").map(|s| s.to_string()).collect();
    // Loops through all rule objects
    for rule in encoded_rules.split(",") {
        // Represents a decoded rule object { particle_one_id, particle_two_id, gravity_force }
        let proxy: Vec<f32> = rule.split(":")
                        .filter_map(|s| s.parse::<f32>().ok())
                        .collect();
        if proxy.len() < 2 {
            continue;
        }
        if proxy[0] as f32 >= particles_arr.len() as f32 || proxy[1] as f32 >= particles_arr.len() as f32 {
            continue;
        }
        let mut p_one: &String = &particles_arr[proxy[0] as usize];
        let mut p_two: &String = &particles_arr[proxy[1] as usize];
        // If we have a proxy[0] or proxy[1] in the temp_updated_encoded_particles vector, we should use that encoded object instead of the original in particles_arr
        if proxy[0] < temp_updated_encoded_particles.len() as f32 {
            p_one = &temp_updated_encoded_particles[proxy[0] as usize];
        }
        if proxy[1] < temp_updated_encoded_particles.len() as f32 {
            p_two = &temp_updated_encoded_particles[proxy[1] as usize];
        }
        let rule_result = trigger_rule(
            p_one.to_string(),
            p_two.to_string(),
            proxy[2] as f32
        );
        // Keep log of updated particle group for future usage if same particle group is needed again (so we can apply future rules to the updated version)
        if temp_updated_encoded_particles.len() as f32 == proxy[0] as f32 {
            temp_updated_encoded_particles.push(rule_result);
        } else {
            temp_updated_encoded_particles[proxy[0] as usize] = rule_result;
        }
    }
    return temp_updated_encoded_particles.join("~");
}

fn trigger_rule(particles_one: String, particles_two: String, g: f32) -> String {
    let p_one: Vec<String> = particles_one.split(",").map(|s| s.to_string()).collect();
    let p_two: Vec<String> = particles_two.split(",").map(|s| s.to_string()).collect();
    let mut new_p_one: Vec<String> = vec![];
    for i in 0..p_one.len() {
        let mut fx: f32 = 0.0;
        let mut fy: f32 = 0.0;
        let mut a: Vec<String> = vec![];
        let mut b: Vec<String> = vec![];
        for j in 0..p_two.len() {
            a = p_one[i].split(":")
                        .map(|s| s.to_string())
                        .collect();
            b = p_two[j].split(":")
                        .map(|s| s.to_string())
                        .collect();
            // If `a` is empty, then we skip it
            if a.len() < 2 || b.len() < 2 {
                continue;
            }
            let dx = a[0].parse::<f32>().unwrap() - b[0].parse::<f32>().unwrap(); // a.x - b.x
            let dy = a[1].parse::<f32>().unwrap() - b[1].parse::<f32>().unwrap(); // a.y - b.y
            let d = ((dx * dx + dy * dy) as f32).sqrt();
            if d > 0.0 && d < 80.0 {
                let force: f32 = (g) * 1.0/d;
                fx += force * dx;
                fy += force * dy;
            }
        }
        // If `a` is empty, then we skip it
        if a.len() < 2 {
            continue;
        }
        a[2] = ((a[2].parse::<f32>().unwrap() + fx) * 0.5).to_string(); // a.vx = (a.vx + fx) * 0.5
        a[3] = ((a[3].parse::<f32>().unwrap() + fy) * 0.5).to_string(); // a.vy = (a.vy + fy) * 0.5
        a[0] = (a[0].parse::<f32>().unwrap() + a[2].parse::<f32>().unwrap()).to_string(); // a.x += a.vx
        a[1] = (a[1].parse::<f32>().unwrap() + a[3].parse::<f32>().unwrap()).to_string(); // a.y += a.vy
        if a[0].parse::<f32>().unwrap() <= 0.0 || a[0].parse::<f32>().unwrap() >= WIDTH { // a.x <= 0 || a.x >= width
            a[2] = (a[2].parse::<f32>().unwrap() * -1.0).to_string(); // a.vx *= -1
        }
        if a[1].parse::<f32>().unwrap() <= 0.0 || a[1].parse::<f32>().unwrap() >= HEIGHT { // a.y <= 0 || a.y >= height
            a[3] = (a[3].parse::<f32>().unwrap() * -1.0).to_string(); // a.vy *= -1
        }
        new_p_one.push(a.join(":"));
    }
    return new_p_one.join(",");
}
