import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
// import { World } from "./components/world/World.tsx";
import { LifeSim } from "./components/life_sim/LifeSim.tsx";
import reportWebVitals from './reportWebVitals.ts';
import { WorkerTest } from "./components/life_sim/WorkerTest.tsx";

// import init, { greet } from "./pkg/rust_component.js";

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
        <LifeSim />
        {/* <WorkerTest /> */}
    </React.StrictMode>
);

// function Test() {
//     const [renderText, setRenderText] = useState("");

//     useEffect(() => {
//         // fetch('http://127.0.0.1:8080/greet')
//         // .then(response => response.text()) // Use response.text() to get the response body as text
//         // .then(body => {
//         //     console.log(body); // Log the response body
//         //     setRenderText(body);
//         // })
//         // .catch(error => {
//         //     console.error('Error:', error);
//         // });
//         fetch('http://127.0.0.1:8080/greet', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ message: 'Hello from the frontend!' })
//         })
//         .then(response => response.text())
//         .then(body => {
//             console.log('Response from POST:', body);
//             setRenderText(body);
//         })
//         .catch(error => {
//             console.error('Error in POST request:', error);
//         });
//     }, [])

//     return (
//         <p>{renderText}</p>
//     )
// }

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();