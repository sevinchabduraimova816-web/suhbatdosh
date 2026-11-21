const fs = require('fs');
const zlib = require('zlib');

function createSolidPNG(width, height, r, g, b) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // 8-bit
    ihdrData[9] = 2; // RGB
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace

    const ihdrChunk = makeChunk('IHDR', ihdrData);

    // Raw image data with filter byte 0 at start of each scanline
    const rowSize = 1 + width * 3;
    const rawData = Buffer.alloc(height * rowSize);
    for (let y = 0; y < height; y++) {
        const offset = y * rowSize;
        rawData[offset] = 0; // filter None
        for (let x = 0; x < width; x++) {
            const px = offset + 1 + x * 3;
            rawData[px] = r;
            rawData[px + 1] = g;
            rawData[px + 2] = b;
        }
    }

    const compressed = zlib.deflateSync(rawData);
    const idatChunk = makeChunk('IDAT', compressed);
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
}

function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

fs.writeFileSync('icon-192.png', createSolidPNG(192, 192, 59, 130, 246));
fs.writeFileSync('icon-512.png', createSolidPNG(512, 512, 59, 130, 246));
console.log('PNG icons created successfully');
