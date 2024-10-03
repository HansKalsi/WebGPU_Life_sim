use actix_cors::Cors;
use actix_web::{web, App, HttpServer, Responder};
mod lib;
use lib::trigger_particle_rules;
use serde::Deserialize;
use std::time::Instant;

#[derive(Deserialize)]
struct RulesCall {
    rules: String,
    particles: String,
}

async fn rules_api(req_body: web::Json<RulesCall>) -> impl Responder {
    let now = Instant::now();
    let updated_particles = trigger_particle_rules(&req_body.rules.to_string(), &req_body.particles.to_string());
    let elapsed = now.elapsed();
    println!("Elapsed for entire iteration: {:.2?}", elapsed);
    format!("{}", updated_particles)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
            )
            // .route("/greet", web::get().to(greet_api))
            .route("/rules", web::post().to(rules_api))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
