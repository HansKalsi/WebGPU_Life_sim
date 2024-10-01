import React, { useState, useEffect, useRef } from "react";
import computeWGSL from "./compute.wgsl";
import vertWGSL from "./vert.wgsl";
import fragWGSL from "./frag.wgsl";

export const World = ({}) => {
  const [worldName, setWorldName] = useState("Gaia");
  const worldCanvas = useRef(null);

  // webgpu base implementation
  const [navigator, setNavigator] = useState<Navigator|null>(null);
  const [adapter, setAdapter] = useState<GPUAdapter|null>(null);
  const [device, setDevice] = useState<GPUDevice|null>(null);
  const [GRID_SIZE, setGridSize] = useState(128); // world size
  const [UPDATE_INTERVAL, setUpdateInterval] = useState(10); // control world speed
  const [WORKGROUP_SIZE, setWorkgroupSize] = useState(8);
 
  // on worldCanvas load (when html loads)
  useEffect(() => {
    if (worldCanvas) {
      console.log("%cstartup effect attempt", 'color: teal');
      setNavigator(window.navigator);
      console.log(`${worldName} world loaded`);
    }
  }, [worldCanvas]);

  useEffect(() => {
    if (navigator) {
      console.log("navigator effect attempt");
      (async () => {
        setAdapter(await navigator.gpu.requestAdapter());
      })();
    }
  }, [navigator]);

  useEffect(() => {
    if (adapter) {
      console.log("adapter effect attempt");
      (async () => {
        setDevice(await adapter.requestDevice());
      })();
    }
  }, [adapter]);

  useEffect(() => {
    if (device) {
      console.log("device effect attempt");
      if (!navigator) {
        throw new Error("No navigator available to device.");
      }

      // WebGPU device initialization
      if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
      }

      initializeWebGPU();
    }
  }, [device]);

  const initializeWebGPU = async () => {
    const canvas = worldCanvas.current as any;
    if (!canvas) {
      // exit function
      return false;
    }

    if (!adapter) {
      throw new Error("No appropriate GPUAdapter found.");
    }
    if (!navigator) {
      throw new Error("No navigator available to device.");
    }
    if (!device) {
      throw new Error("No device available to adapter.");
    }

    // Canvas configuration
    const context = canvas.getContext("webgpu") as GPUCanvasContext;
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device!,
        format: canvasFormat,
        alphaMode: 'premultiplied', // TODO: test line
    });

    // Create the compute shader that will process the game of life simulation.
    const computeShaderModule = device.createShaderModule({
      label: "Life compute shader",
      code: computeWGSL,
    });

    // Create the compute bind group layout.
    const bindGroupLayoutCompute = device.createBindGroupLayout({
      label: "Compute Cell Bind Group Layout",
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'read-only-storage',
        } // Grid uniform buffer
      }, {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" } // Cell state input buffer
      }, {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage"} // Cell state output buffer
      }]
    });

    // Create a buffer with the vertices for a single cell.
    // const vertices = new Float32Array([
    //   -0.8, -0.8,
    //    0.8, -0.8,
    //    0.8,  0.8,

    //   -0.8, -0.8,
    //    0.8,  0.8,
    //   -0.8,  0.8,
    // ]);
    const vertices = new Uint32Array([0, 0, 0, 1, 1, 0, 1, 1]);
    const vertexBuffer = device.createBuffer({
      label: "Cell vertices",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Uint32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();
    // device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // const vertexBufferLayout: GPUVertexBufferLayout = {
    const squareStride: GPUVertexBufferLayout = {
      arrayStride: 2 * vertices.BYTES_PER_ELEMENT,
      stepMode: "vertex",
      attributes: [{
        shaderLocation: 1, // Position. Matches @location(0) in the @vertex shader. TODO: edited to 1 from original 0
        offset: 0,
        format: "uint32x2",
        // format: "float32x2",
      }],
    };

    const vertexCellShaderModule = device.createShaderModule({
      label: "Vertex cell shader",
      code: vertWGSL
    });

    // Create the shader that will render the cells.
    const fragmentCellShaderModule = device.createShaderModule({
      label: "Cell shader",
      code: fragWGSL
    });

    const bindGroupLayoutRender = device.createBindGroupLayout({
      entries:[{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" }
      }]
    });

    const cellsStride: GPUVertexBufferLayout = {
      arrayStride: Uint32Array.BYTES_PER_ELEMENT,
      stepMode: "instance",
      attributes: [{
        shaderLocation: 0, // Cell. Matches @location(0) in the @vertex shader.
        offset: 0,
        format: "uint32",
      }],
    };

    let wholeTime = 0,
      loopTimes = 0,
      buffer0: GPUBuffer,
      buffer1: GPUBuffer;
    let render: () => void;
    function resetGameData() {
      if (!device) {
        throw new Error("No device available to adapter in resetGameData.");
      }

      // compute pipeline
      const computePipeline = device.createComputePipeline({
        label: "Compute pipeline",
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayoutCompute]
        }),
        compute: {
          module: computeShaderModule,
          entryPoint: "main",
          constants: {
            blockSize: WORKGROUP_SIZE,
          },
        }
      });

      const sizeBuffer = device.createBuffer({
        size: 2 * Uint32Array.BYTES_PER_ELEMENT,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.UNIFORM |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
      });
      new Uint32Array(sizeBuffer.getMappedRange()).set([GRID_SIZE, GRID_SIZE]);
      sizeBuffer.unmap();
      const length = GRID_SIZE * GRID_SIZE;
      const cells = new Uint32Array(length);
      for (let i = 0; i < length; ++i) {
        cells[i] = Math.random() < 0.25 ? 1 : 0;
      }

      buffer0 = device.createBuffer({
        size: cells.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
      });
      new Uint32Array(buffer0.getMappedRange()).set(cells);
      buffer0.unmap();

      buffer1 = device.createBuffer({
        size: cells.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
      });

      const bindGroup0 = device.createBindGroup({
        label: "Compute bind group (bindGroup0)",
        layout: bindGroupLayoutCompute,
        entries: [
          {binding: 0, resource: {buffer: sizeBuffer}},
          {binding: 1, resource: {buffer: buffer0}},
          {binding: 2, resource: {buffer: buffer1}},
        ]
      });

      const bindGroup1 = device.createBindGroup({
        label: "Compute bind group (bindGroup1)",
        layout: bindGroupLayoutCompute,
        entries: [
          {binding: 0, resource: {buffer: sizeBuffer}},
          {binding: 1, resource: {buffer: buffer1}},
          {binding: 2, resource: {buffer: buffer0}},
        ]
      });

      const renderPipeline = device.createRenderPipeline({
        label: "Render pipeline",
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayoutRender]
        }),
        primitive: {
          topology: "triangle-strip",
        },
        vertex: {
          module: vertexCellShaderModule,
          entryPoint: "main",
          buffers: [cellsStride, squareStride]
        },
        fragment: {
          module: fragmentCellShaderModule,
          entryPoint: "main",
          targets: [{
            format: canvasFormat
          }]
        }
      });

      const uniformBindGroup = device.createBindGroup({
        label: "Uniform bind group",
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: {
            buffer: sizeBuffer,
            offset: 0,
            size: 2 * Uint32Array.BYTES_PER_ELEMENT,
          }
        }]
      });

      render = () => {
        const view = context.getCurrentTexture().createView();
        const renderPass: GPURenderPassDescriptor = {
          colorAttachments: [{
            view,
            loadOp: 'clear',
            storeOp: 'store',
          }]
        };
        let commandEncoder = device.createCommandEncoder();

        // Compute
        const passEncoderCompute = commandEncoder.beginComputePass();
        passEncoderCompute.setPipeline(computePipeline);
        passEncoderCompute.setBindGroup(0, loopTimes ? bindGroup1 : bindGroup0);
        passEncoderCompute.dispatchWorkgroups(
          GRID_SIZE / WORKGROUP_SIZE,
          GRID_SIZE / WORKGROUP_SIZE,
        );
        passEncoderCompute.end();

        // Render
        const passEncoderRender = commandEncoder.beginRenderPass(renderPass);
        passEncoderRender.setPipeline(renderPipeline);
        passEncoderRender.setVertexBuffer(0, loopTimes ? buffer1 : buffer0);
        passEncoderRender.setVertexBuffer(1, vertexBuffer);
        passEncoderRender.setBindGroup(0, uniformBindGroup);
        passEncoderRender.draw(4, length);
        passEncoderRender.end();

        device.queue.submit([commandEncoder.finish()])
      };
    }

    resetGameData();

    (function loop() {
      if (UPDATE_INTERVAL) {
        wholeTime++;
        if (wholeTime >= UPDATE_INTERVAL) {
          render(); // assigned in resetGameData
          wholeTime -= UPDATE_INTERVAL;
          loopTimes = 1 - loopTimes;
        }
      }

      requestAnimationFrame(loop);
    })();

    // // Create the bind group layout and pipeline layout.
    // const bindGroupLayout = device.createBindGroupLayout({
    //   label: "Cell Bind Group Layout",
    //   entries: [{
    //     binding: 0,
    //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
    //     buffer: {} // Grid uniform buffer
    //   }, {
    //     binding: 1,
    //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
    //     buffer: { type: "read-only-storage"} // Cell state input buffer
    //   }, {
    //     binding: 2,
    //     visibility: GPUShaderStage.COMPUTE,
    //     buffer: { type: "storage"} // Cell state output buffer
    //   }]
    // });

    // const pipelineLayout = device.createPipelineLayout({
    //   label: "Cell Pipeline Layout",
    //   bindGroupLayouts: [ bindGroupLayout ],
    // });

    //// vertex & fragment shader module code
    // code: `
    // struct VertexOutput {
    //     @builtin(position) position: vec4f,
    //     @location(0) cell: vec2f,
    //   };

    //   @group(0) @binding(0) var<uniform> grid: vec2f;
    //   @group(0) @binding(1) var<storage> cellState: array<u32>;

    //   @vertex
    //   fn vertexMain(@location(0) position: vec2f,
    //                 @builtin(instance_index) instance: u32) -> VertexOutput {
    //     var output: VertexOutput;

    //     let i = f32(instance);
    //     let cell = vec2f(i % grid.x, floor(i / grid.x));

    //     let scale = f32(cellState[instance]);
    //     let cellOffset = cell / grid * 2;
    //     let gridPos = (position*scale+1) / grid - 1 + cellOffset;

    //     output.position = vec4f(gridPos, 0, 1);
    //     output.cell = cell / grid;
    //     return output;
    //   }

    //   @fragment
    //   fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    //     return vec4f(input.cell, 1.0 - input.cell.x, 1);
    //   }
    // `
    //// end shader module code

    // // Create a pipeline that renders the cell.
    // const cellPipeline = device.createRenderPipeline({
    //   label: "Cell pipeline",
    //   layout: pipelineLayout,
    //   vertex: {
    //     module: vertexCellShaderModule,
    //     entryPoint: "main", // is the fn name under @vertex
    //     buffers: [vertexBufferLayout]
    //   },
    //   fragment: {
    //     module: fragmentCellShaderModule,
    //     entryPoint: "main", // is the fn name under @fragment
    //     targets: [{
    //       format: canvasFormat
    //     }]
    //   }
    // });

    //// compute shader module code
    //   code: `
    //   @group(0) @binding(0) var<uniform> grid: vec2f;

    //   @group(0) @binding(1) var<storage> cellStateIn: array<u32>;
    //   @group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>;

    //   fn cellIndex(cell: vec2u) -> u32 {
    //     return (cell.y % u32(grid.y)) * u32(grid.x) +
    //            (cell.x % u32(grid.x));
    //   }

    //   fn cellActive(x: u32, y: u32) -> u32 {
    //     return cellStateIn[cellIndex(vec2(x, y))];
    //   }

    //   @compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
    //   fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
    //     // Determine how many active neighbors this cell has.
    //     let activeNeighbors = cellActive(cell.x+1, cell.y+1) +
    //                           cellActive(cell.x+1, cell.y) +
    //                           cellActive(cell.x+1, cell.y-1) +
    //                           cellActive(cell.x, cell.y-1) +
    //                           cellActive(cell.x-1, cell.y-1) +
    //                           cellActive(cell.x-1, cell.y) +
    //                           cellActive(cell.x-1, cell.y+1) +
    //                           cellActive(cell.x, cell.y+1);

    //     let i = cellIndex(cell.xy);

    //     // Conway's game of life rules:
    //     switch activeNeighbors {
    //       case 2: { // Active cells with 2 neighbors stay active.
    //         cellStateOut[i] = cellStateIn[i];
    //       }
    //       case 3: { // Cells with 3 neighbors become or stay active.
    //         cellStateOut[i] = 1;
    //       }
    //       default: { // Cells with < 2 or > 3 neighbors become inactive.
    //         cellStateOut[i] = 0;
    //       }
    //     }
    //   }
    // `
    //// end shader module code

    // // Create a compute pipeline that updates the game state.
    // const simulationPipeline = device.createComputePipeline({
    //   label: "Compute pipeline",
    //   layout: pipelineLayout,
    //   compute: {
    //     module: computeShaderModule,
    //     entryPoint: "main",
    //     constants: {
    //       blockSize: WORKGROUP_SIZE,
    //     },
    //   }
    // });

    // // Create a uniform buffer that describes the grid.
    // const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
    // const uniformBuffer = device.createBuffer({
    //   label: "Grid Uniforms",
    //   size: uniformArray.byteLength,
    //   usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    // });
    // device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

    // // Create an array representing the active state of each cell.
    // const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

    // // Create two storage buffers to hold the cell state.
    // const cellStateStorage = [
    //   device.createBuffer({
    //     label: "Cell State A",
    //     size: cellStateArray.byteLength,
    //     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    //   }),
    //   device.createBuffer({
    //     label: "Cell State B",
    //     size: cellStateArray.byteLength,
    //     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    //   })
    // ];

    // // Set each cell to a random state, then copy the JavaScript array into
    // // the storage buffer.
    // for (let i = 0; i < cellStateArray.length; ++i) {
    //   cellStateArray[i] = Math.random() > 0.6 ? 1 : 0;
    // }
    // device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

    // // Create a bind group to pass the grid uniforms into the pipeline
    // const bindGroups = [
    //   device.createBindGroup({
    //     label: "Cell renderer bind group A",
    //     layout: bindGroupLayout,
    //     entries: [{
    //       binding: 0,
    //       resource: { buffer: uniformBuffer }
    //     }, {
    //       binding: 1,
    //       resource: { buffer: cellStateStorage[0] }
    //     }, {
    //       binding: 2,
    //       resource: { buffer: cellStateStorage[1] }
    //     }],
    //   }),
    //   device.createBindGroup({
    //     label: "Cell renderer bind group B",
    //     layout: bindGroupLayout,
    //     entries: [{
    //       binding: 0,
    //       resource: { buffer: uniformBuffer }
    //     }, {
    //       binding: 1,
    //       resource: { buffer: cellStateStorage[1] }
    //     }, {
    //       binding: 2,
    //       resource: { buffer: cellStateStorage[0] }
    //     }],
    //   }),
    // ];

    // let step = 0;
    // function updateGrid() {
    //   let commandEncoder: GPUCommandEncoder;
    //   commandEncoder = device.createCommandEncoder();

    //   // Start a compute pass
    //   const passEncoderCompute = commandEncoder.beginComputePass();
    //   passEncoderCompute.setPipeline(simulationPipeline);
    //   passEncoderCompute.setBindGroup(0, bindGroups[step % 2]);
    //   const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
    //   passEncoderCompute.dispatchWorkgroups(workgroupCount, workgroupCount);
    //   passEncoderCompute.end();

    //   step++; // Increment the step count

    //   // Start a render pass
    //   const renderPass: GPURenderPassDescriptor = {
    //     colorAttachments: [{
    //       view: context.getCurrentTexture().createView(),
    //       loadOp: 'clear',
    //       clearValue: { r: 1, g: 0, b: 0, a: 1.0 },
    //       storeOp: "store",
    //     }]
    //   };
    //   const passEncoderRender = commandEncoder.beginRenderPass(renderPass);

    //   // Draw the grid.
    //   passEncoderRender.setPipeline(cellPipeline);
    //   passEncoderRender.setVertexBuffer(0, vertexBuffer);
    //   passEncoderRender.setBindGroup(0, bindGroups[step % 2]); // Updated!
    //   passEncoderRender.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);

    //   // End the render pass and submit the command buffer
    //   passEncoderRender.end();
    //   device.queue.submit([commandEncoder.finish()]);
    // }
    // setInterval(updateGrid, UPDATE_INTERVAL);
  };

  return (
    <canvas id={worldName} width="1024" height="1024" ref={worldCanvas}/>
  );
};
