import { listEquals as equals } from "../utils/utils.js";

/**
 * Do what it says on the tin
 */
export function getMimeType(fileName) {
  return getViewType(fileName).type;
}

/**
 * This is "magic number" based affirmative mimetyping
 * function, meaning we first naively assume the mimetype
 * based on the extension, and then we check to verify
 * that assumption based on knowing a fixed set of bytes
 * that must be in that specific type of file.
 */
export function getViewType(filename) {
  const ext = filename.substring(filename.lastIndexOf(`.`) + 1);

  // known "editable text" extensions
  const text = {
    css: `text/css`,
    csv: `text/csv`,
    htm: `text/html`,
    html: `text/html`,
    java: `application/java`,
    js: `text/javascript`,
    json: `application/json`,
    jsx: `text/javascript`,
    md: `text/markdown`,
    py: `application/python`,
    ts: `text/javascript`,
    rs: `application/rust`,
    tsx: `text/javascript`,
    txt: `text/plain`,
    xml: `application/xml`,
  };

  let type = text[ext];
  if (type)
    return {
      type,
      text: true,
      editable: true,
    };

  // known "viewable media" extensions
  const media = {
    gif: `image/gif`,
    jpg: `image/jpg`,
    jpeg: `image/jpg`,
    png: `image/png`,
    mov: `video/quicktime`,
    mp3: `audio/mpeg`,
    mp4: `video/mp4`,
    wav: `audio/wav`,
  };

  type = media[ext];
  if (type)
    return {
      type,
      media: true,
      editable: false,
    };

  // Treat anything we don't know as text, but not editable
  return { type: `text/plain`, editable: true, unknown: true };
}

/**
 * Verify a file is what its extension claims to be by looking at magic numbers.
 */
export function verifyViewType(type, data) {
  const bytes = new Uint8Array(data);
  if (type.startsWith(`text`) || type.startsWith(`application`)) return true;
  if (type === `image/gif`) return verifyGIF(bytes);
  if (type === `image/jpg`) return verifyJPG(bytes);
  if (type === `image/png`) return verifyPNG(bytes);
  if (type === `audio/mpeg`) return verifyMP3(bytes);
  if (type === `audio/wav`) return verifyWave(bytes);
  if (type === `video/quicktime`) return verifyMov(bytes);
  if (type === `video/mp4`) return verifyMP4(bytes);
  return false;
}

function verifyGIF(bytes) {
  // console.log(`GIF`, bytes.slice(0, 4));
  return equals(bytes.slice(0, 4), [0x47, 0x49, 0x46, 0x38]);
}

function verifyJPG(bytes) {
  // console.log(`jpg`, bytes.slice(0, 4));
  return (
    equals(bytes.slice(0, 4), [0xff, 0xd8, 0xff, 0xdb]) ||
    equals(bytes.slice(0, 4), [0xff, 0xd8, 0xff, 0xe0]) ||
    equals(bytes.slice(0, 4), [0xff, 0xd8, 0xff, 0xe1]) ||
    equals(bytes.slice(0, 4), [0xff, 0xd8, 0xff, 0xee])
  );
}

function verifyPNG(bytes) {
  // console.log(`png`, bytes.slice(0, 4));
  return equals(bytes.slice(0, 4), [0x89, 0x50, 0x4e, 0x47]);
}

function verifyMP3(bytes) {
  // We assume it's ID3 tagged
  // console.log(`mp3`, bytes.slice(0, 3));
  return equals(bytes.slice(0, 3), [0x49, 0x44, 0x33]);
}

function verifyMov(bytes) {
  console.log(`mov`, bytes.slice(0, 8));
  return equals(bytes.slice(0, 8), [0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70]);
}

function verifyMP4(bytes) {
  // console.log(`mp4`, bytes.slice(0, 4));
  return equals(bytes.slice(0, 4), [0x66, 0x74, 0x79, 0x70]);
}

function verifyWave(bytes) {
  // console.log(`wave`, data.slice(8, 12));
  return (
    verifyRIFF(bytes) && equals(bytes.slice(8, 12), [0x57, 0x41, 0x56, 0x4])
  );
}

function verifyRIFF(bytes) {
  // console.log(`riff`, bytes.slice(0, 4));
  return equals(data.substring(0, 4), [0x52, 0x49, 0x46, 0x6]);
}
