import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import reportWebVitals from './reportWebVitals.ts';

// function renderWorld() {
//     const [count, setCount] = useState(0);
//     console.log('Hello World');
//     return (
//         <>
//             <h1>{count}</h1>
//             <button onClick={() => setCount(count + 1)}>
//             Increment
//             </button>
//         </>
//     );
// }


const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();