# Synapse Relay Specification - `v0.1.0`

WORK IN PROGRESS DRAFT, NOT COMPLETED.

TODO:
- More details for error responses for HTTP endpoints, and possibly relay messages?
- Include health check mechanism?
- Include base URL GET request and/or server info get request?
- authentication approach:
  - is this the best way in terms of both cryptography concepts and implementation
  - implementation would involve storing challenge/pid values and assigning to relay on connection.
  - could a method be stateless? allowing proof of ownership in a none replayable way while allowing the server to not store data ahead of time
- should direct messaging should allow multiple pids?

---

This specification defines the behaviour and message protocol which a synapse relay server MUST implement.
This covers a process for authenticating connections and a message protocol which is designed to establish a shared
foundation while allowing peers to evolve custom messaging systems on top.

## Overview
The server does not provide a single "global" relay, peers connect using a public key and can communicate with other
peers connected via that same public key. The server authenticates these connections, meaning a peer must prove ownership
over the corresponding private key to join a relay.

Peers cannot discover or communicate with other peers connected via different public keys.  
This is similar to the concept of a "room" seen in WebSocket libraries such as [socket.io](https://socket.io/docs/v4/rooms/).

## Cryptography
- `secp256k1` public/private key pairs are expected. This specification does not cover their generation or use.

## Authentication

### Challenges
A server issued challenge is used to prove ownership of the given public key when connecting to the relay.  
The server issues a randomly generated value (the challenge) which the peer signs with the corresponding private key and
includes during the WebSocket connection. The server stores the challenge, and allows the peer to connect if the supplied response is valid.

The challenge MUST be a cryptographically secure randomly generated 128 bits, encoded as a base64 string.

The server MUST temporarily store this challenge to validate during the WebSocket connection attempt.
The server MUST deny connection attempts with challenges it does not recognise, even if signed correctly.

A challenge MUST be considered stale after a short amount of time (recommended 5-10 seconds), and MUST only be usable once and while not stale.
It is expected that the server can simply delete challenges once stale, however this is an implementation detail not covered by this spec.

### WebSocket Connection
The server MUST provide a `/connect [POST]` endpoint for peers to request a connection, accepting a JSON body of:
```json5
{
  "name": "<human readable peer/connection name>",
  "key": "<BASE64-ENCODED-PUBLIC-KEY>"
}
```

On valid requests the server MUST generate a challenge for the peer to complete and a peerID (or `pid`) value conforming to UUID v4.
The server MUST return these properties with 200 status code and the JSON body:
```json5
{
  // The peerID (UUIDv4) which will be assigned to the peer on connection.
  "pid": "00000000-0000-0000-0000-000000000000",
  // The challenge the peer must sign to prove ownership over the private key and join the relay.
  "challenge": "<BASE64-ENCODED-128-BIT-CHALLENGE>"
}
```

The server MUST expose the WebSocket relay server via the URL `/relay/<BASE64-ENCODED-PUBLIC-KEY>` and expect challenge responses to be included in the `Sec-WebSocket-Protocol` header. 
The server MUST validate the challenge response supplied for the public key as per the above section, and either deny the WebSocket upgrade or connect the client to the relay.  
The server MUST associate the peer with the previously generated peer ID, to allow for direct messaging as per the messaging protocol below.

Thet server MUST only allow WebSocket upgrades and connections using the defined delay URL above.

### Error Responses
The server MUST return standard error responses including 400/401/403/429/500 status codes based on scenario with the following JSON response body:
```json5
{
  // REQUEST_INVALID, ACCESS_FORBIDDEN, ACCESS_UNAUTHORIZED, ACCESS_RATE_LIMIT
  "reason": "REQUEST_INVALID",
  // An explanation of the issue/error suitable for users
  "message": "..."
}
```

### Custom Behaviour
The server MAY choose to implement additional custom behaviour for authentication beyond the specification, such as a system
to whitelist/blacklist specific public keys, protect from bots, rate limit etc. This COULD include adding additional request and
response properties, however this is discouraged where possible.

In these cases the server implementation MUST still retain the outlined success and error response structures, but may extend them.

## Connection Management
There is no currently defined behaviour for re-authentication or similar. This may change in future.    

Server implementations MUST only allow peers to communicate to other peers connected via the same public key.   
The details of this are implementation concerns not covered in this spec.

A mechanism for connection health checks is described in the "messaging" section below, which a server MUST follow.

## Messaging
All messages sent and received MUST be UTF-8 encoded JSON object conforming to the [message types](#message-type-reference) described below.  
The relay and peers SHOULD validate messages, and on malformed or unexpected messages, may choose to either ignore or close the connection.

### Connection Checks (ping/pong)
In order to monitor connection health the server MUST send periodic `ping` messages to all peers. When receiving these, the connected peer MUST respond by sending a `pong` message.  
The server MUST determine that a connection is stale if the peer sends no pong replies or other messages for a given duration (exact value is at the discretion of the server), at which point it MUST close the connection.  

Peers MUST implement the same logic to monitor connection health with the server.  
When the server sends a `ping` message, the peer MUST respond by sending a `pong` message.  
If a peer determines that the connection is stale (no pong replies or other message from the server for a given duration) it is expected close the connection and attempt to reconnect.

The server MUST never relay `ping`/`pong` messages between peers, these are unique to each connection.

### Peer Discovery
When a peer connect or disconnects to the relay, the server MUST broadcast a `peers.list` message to all peers including the newly connected peer if applicable.
Peers may also choose to send a `peers.discover` message, which the server MUST reply to with a `peers.list` message.   
When responding to a `peers.discover` message, the server MUST only send the reply to the requesting peer.

### Message Sending
A peer can send a message to peers using the `message` message. On receiving a message, the server MUST
attach the `from` property (the sending peers `pid`) before broadcasting the message to all other connected peers.   
The sending peer MUST not receive the message they sent.

A peer may send to a specific peer by setting the `to` property to a `pid` value. The server MUST still
attach the `from` property and MUST retain the `to` property.  
The server MUST then send the message to the specific peer, and not broadcast to all peers.

On an invalid `pid` value, the server may choose to either ignore the message or close the connection.

### Message Type Reference

#### Common Messages

Message used to request a `pong` event, used to monitor connection health:
```json5
{
  kind: "ping",
}
```

Message response to a `ping` request, used to monitor connection health:
```json5
{
  kind: "pong",
}
```

#### Peer Sent Messages

Message used to discover connected peers:
```json5
{
  kind: "peers.discover"
}
```
Server will respond with a `peers.list` message (see below).


Message to broadcast to all peers:
```json5
{
  kind: "message",
  // (optional) string or object - the message content
  // treated as opaque by the relay
  content: "",
  // (optional) object - metadata about the message
  // treated as opaque by the relay, is intended to allow peers to include metadata seperate from the message content.
  // this could be used in cases such as versioning, hashing, additional type metadata etc.
  meta: {},
}
```

Message to send to specific peer:
```json5
{
  kind: "message",
  // (required) UUIDv4 string - included to send the message to a specific peer
  to: "00000000-0000-0000-0000-000000000000",
  // (optional) string or object - the message content
  // treated as opaque by the relay
  content: "",
  // (optional) object - metadata about the message
  // treated as opaque by the relay, is intended to allow peers to include metadata seperate from the message content.
  // this could be used in cases such as versioning, hashing, additional type metadata etc.
  meta: {},
}
```

#### Server Sent Message

On receiving a `message` kind (broadcast or direct) from a peer, the relay MUST add the `from` property containing the peer's `pid` value before broadcasting to other connected peers.

Message broadcast to all peers:
```json5
{
  kind: "message",
  // (required) UUIDv4 string - the peer which sent the message
  from: "00000000-0000-0000-0000-000000000000",
  // (optional) string or object - the message content
  // treated as opaque by the relay
  content: "",
  // (optional) object - metadata about the message
  // treated as opaque by the relay, is intended to allow peers to include metadata seperate from the message content.
  // this could be used in cases such as versioning, hashing, additional type metadata etc.
  meta: {},
}
```

Message sent to a specific peer:
```json5
{
  kind: "message",
  // (required) UUIDv4 string - included to send the message to a specific peer
  to: "00000000-0000-0000-0000-000000000000",
  // (required) UUIDv4 string - the peer which sent the message
  from: "00000000-0000-0000-0000-000000000000",
  // (optional) string or object - the message content
  // treated as opaque by the relay
  content: "",
  // (optional) object - metadata about the message
  // treated as opaque by the relay, is intended to allow peers to include metadata seperate from the message content.
  // this could be used in cases such as versioning, hashing, additional type metadata etc.
  meta: {},
}
```

Message response to `peer.discover` requests sent by peers. This MUST only be sent to the peer sending the request:
```json5
{
  kind: "peers.list",
  peers: [
    {
      // (required) UUIDv4 string - the peerID
      pid: "00000000-0000-0000-0000-000000000000",
      // (optional) string - the name supplied by the peer on connection
      name: "<human readable peer/connection name>",
    }
  ]
}
```
This message MUST also be broadcast by the server when a peer connects or disconnects.
