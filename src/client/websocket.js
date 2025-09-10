// Are we a logged in user, able to set up a web socket coonection?
let ws = undefined;

try {
  ws = new WebSocket(location.toString().replace(`https:`, `wss:`));
} catch (e) {
  // nope: no websocket connection for this user.
}

// TODO: This should be a reconnecting websocket, relying on server side session verification

export { ws };
