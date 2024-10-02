use actix_cors::Cors;
use actix_web::{web, App, HttpServer, Responder};
mod lib;
use lib::greet;
use serde::Deserialize;

#[derive(Deserialize)]
struct GreetRequest {
    message: String,
}

async fn greet_api(req_body: web::Json<GreetRequest>) -> impl Responder {
    let greeting = greet(&req_body.message);
    format!("{}", greeting)
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
            .route("/greet", web::post().to(greet_api))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
