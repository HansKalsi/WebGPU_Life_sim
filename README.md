# Useful Commands
## Rust
`wasm-pack build --target web`

# Useful Info
## Learning Progression
If you are interested in learning how this final iteration came to be, I would recommend looking through the commit history, as there are some major Rust related performance improvements, thus far these have improved the backend computation time as follows:
(for context, a 'rule comparison' is an operation comparing a single particle in a particle group to every particle in another particle group and computing the gravity effects)
### For Loop Hell
- Few particle groups (5 total)
- Between **2 - 10** seconds per frame update
- On average, each rule comparison took **~600ms**
### Parallelising Particle Rule Comparisons
- Few particle groups (5 - 8 total)
- Between **0.8 - 5** seconds per frame update
- On average, each rule comparison took **~200ms**
### Full Parallelisation
- Some particle groups (5 - 10 total)
- Between **0.5 - 1** seconds per frame update
- On average, each rule comparison took **~250µs** (although there was some performance issues due to Mutex usage)
### Optimised Threading By Particle Group (by splitting into multiple threads updating each particle group by its rules simultaneously)
- Many particle groups (10 - 15 total)
- Between **0.3 - 0.6** seconds per frame update
- On average, each rule comparison took **~90µs**

## Frontend
React is the frontend, by doing a local dev server via `npm start`, we can use api calls to the backend

## Backend
Rust is the backend, by doing a local dev server via `cargo run dev`, we enable access for the frontend
The backend must be re-run after changes as it appears not to re-trigger itself atm
