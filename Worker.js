/*
    Worker.js - Metodo a push

    Un ring buffer per lo stream di dati dal esp32
    Un ring buffer per il requestAnimationFrame 60Hz 16.6ms
*/
const RING_SIZE = 4096;
// 2000 frame / 60fps = 33 frame di monitor, 0.55 secondi di storia
// 2000 x 12 byte di playload = 24.000 byte 24kb
const RENDER_BUFFER_SIZE = 2000; 

const HEADER_HI = 0xAA;
const HEADER_LO = 0x55;
const PAYLOAD_SIZE = 12;
const PACKET_SIZE = 2 + PAYLOAD_SIZE + 1; // header + playload + crc

let ring = new Uint8Array(RING_SIZE);
let head = 0;
let tail = 0;

let renderBuffer = new Int32Array(RENDER_BUFFER_SIZE * 3);
let renderWriteIndex = 0;
let renderReadIndex = 0;

let controller = null;
let reader = null;
let running = false;

let packetData = new Uint8Array(PAYLOAD_SIZE);
let view = new DataView(packetData.buffer);

let lastStreamX = null;
let lastStreamY = null;
let lastStreamZ = null;

function flush() {
    ring.fill(0);
    head = tail = 0;
    renderWriteIndex = renderReadIndex = 0;
    lastStreamX = lastStreamY = lastStreamZ = null;
}


function getLen() {
    return (head - tail + RING_SIZE) % RING_SIZE;
}


function peek(offset) {
    return ring[(tail + offset) % RING_SIZE];
}


function consume(n) {
    tail = (tail + n) % RING_SIZE;
}


function writeToRing(value) {
    for (let i = 0; i < value.length; i++) {
        const nextHead = (head + 1) % RING_SIZE;

        // Overflow scarta il byte piu' vecchio
        if (nextHead === tail) tail = (tail + 1) % RING_SIZE;

        ring[head] = value[i];
        head = nextHead;
    }
}


// Checksum CRC8
function crc8(data) {
    let crc = 0x00;
    for (let byte of data) {
        for (let i = 0; i < 8; i++) {
            let sum = (crc ^ byte) & 0x01;
            crc >>= 1;
            if (sum) crc ^= 0x8C;
            byte >>= 1;
        }
    }
    return crc;
}


 // Streaming dati dal esp32 [HEADER][X int32][Y int32][Z int32][CRC8]
self.onmessage = async (event) => {
    if (event.data === 'START' && !running) {
        running = true;

        // Non usare un flush perchè il render gira sempre a 60Hz, quindi svuotare il ring buffer
        // crea un buco logico. 
        // Il parser non ha ancora nuovi byte dall'ESP32, mentre il render continua a chiedere 
        // snapshot e legge frame non validi/zero.
        // Lasciando il ring buffer intatto, la continuità è preservata.
        //flush();

        lastStreamX = null;
        lastStreamY = null;
        lastStreamZ = null;

        controller = new AbortController();
      
        try {
            const response = await fetch('/stream', { signal: controller.signal });
            reader = response.body.getReader();
            streamLoop().catch(err => {
                if (err.name !== 'AbortError') {
                    console.log("Worker promise error: ", err);
                }
            });
        } catch (err) {
            if (err.name !== 'AbortError') console.log("Worker fetch error: ", err);
        }
    }

    if (event.data === 'STOP' && running) {
        running = false;
        controller?.abort();

        // Uncaught (in promise) AbortError: BodyStreamBuffer was aborted
        //reader?.cancel(); <-- Non usare, non serve
    }

    
   if (event.data === 'REQUEST_UPDATE' && running) {
        const framesCount = (renderWriteIndex - renderReadIndex + RENDER_BUFFER_SIZE) % RENDER_BUFFER_SIZE;

        if (framesCount > 0) {
            const batch = new Int32Array(framesCount * 3);

            for (let i = 0; i < framesCount; i++) {
                const src = renderReadIndex * 3;
                const dst = i * 3;

                batch[dst]      = renderBuffer[src];
                batch[dst + 1]  = renderBuffer[src + 1];
                batch[dst + 3]  = renderBuffer[src + 2];

                renderReadIndex = (renderReadIndex + 1) % RENDER_BUFFER_SIZE;
            }

            self.postMessage({ type: 'DATA_BATCH', frames: batch }, [batch.buffer]); // <- Transferable TypedArray
        }
   }
};

async function streamLoop() {
    try {
        while (running) {
            const { value, done } = await reader.read();
            if (done || !running) break;
            if (!value) continue;

            writeToRing(value);
           
            // Cerca pacchetti completi 15 byte
            while (getLen() >= PACKET_SIZE) {
                // Trovato Header
                if (peek(0) === HEADER_HI && peek(1) === HEADER_LO) {
                    // Estrai i 12byte, offset 2 a 13
                    for (let j = 0; j < PAYLOAD_SIZE; j++) packetData[j] = peek(2 + j);

                    // Verifica CRC
                    if (crc8(packetData) === peek(PACKET_SIZE - 1)) {
                        const x = view.getInt32(0, true);
                        const y = view.getInt32(4, true);
                        const z = view.getInt32(8, true);

                        // Skip nel buffer dello stream. Se è identico al precedente non scrivere nel render buffer
                        if (x !== lastStreamX || y !== lastStreamY || z !== lastStreamZ) {
                            const base = renderWriteIndex * 3;
                            renderBuffer[base] = x;
                            renderBuffer[base + 1] = y;
                            renderBuffer[base + 2] = z;

                            renderWriteIndex = (renderWriteIndex + 1) % RENDER_BUFFER_SIZE;

                            // Protezione overflow
                            if (renderWriteIndex === renderReadIndex) {
                                renderReadIndex = (renderReadIndex + 1) % RENDER_BUFFER_SIZE;
                            }

                            lastStreamX = x;
                            lastStreamY = y;
                            lastStreamZ = z;
                        }

                        consume(PACKET_SIZE);
                        continue;
                    }

                    // CRC errato -> scarta header e riallinea
                    consume(1);
                    continue;
                }

                // Header non trovato -> scarta un byte
                consume(1);
            }
        }
    } catch (err) {
        if (err.name !== 'AbortError') console.log("Stream error: ", err);
    }
}
