# Synapse Relay Specification - `v0.1.0`

WORK IN PROGRESS DRAFT, NOT COMPLETED.

TODO:
- More details for error responses for HTTP endpoints, and possibly relay messages?
- Include health check mechanism?
- Include base URL GET request and/or server info get request?
- should direct messaging should allow multiple pids?

---

This specification defines the behaviour and message protocol which a synapse relay server MUST implement.
This covers a very basic process for authentication and a message protocol designed to establish a shared
foundation while allowing peers to evolve custom messaging systems.

## Overview
The server does not provide a single global "relay", peers connect using a relay ID (`relayId`) and can communicate with other peers connected to that same `relayId`.  
This is similar to the concept of a "room" seen in WebSocket libraries such as [socket.io](https://socket.io/docs/v4/rooms/).  
Peers cannot discover or communicate with other peers connected via a different `relayId`.  

Note that in this basic specification, the server is not expected to authenticate access to a given `relayId`, only
access to the general server itself. A future protocol version could introduce public/private key cryptography where
relay identifiers are actually public keys, or another form of authentication to support private multi-user access.

## Authentication / Connection
The server MUST restrict relay access via a basic secret token, meaning only those with the token can connect.  
Synapse is not designed for public/shared use, so no mechanisms are present in this spec to allow for private multi-user access.

The server MUST expose the WebSocket relay server via the URL `/relay/<RELAY-ID>` and expect the secret token to be included in the `Sec-WebSocket-Protocol` header.  
Peers MUST also supply a peer ID (`peerId`) query parameter conforming to UUIDv4 to identify themselves, and optionally a human-readable peer name (`peerName`) string parameter too.

The server MUST validate the token and deny the WebSocket connection if not valid.  
The server MUST validate the `peerId` query parameter and prevent multiple peers using the same ID. It should deny the connection if either scenario fail.  
The server MAY also choose to validate the `peerName` parameter and deny connections if multiple peers attempt to use the same name.

The server MUST deny all WebSocket connections not made to the defined relay URL above.

## Connection Management
There is no currently defined behaviour for re-authentication or similar. This may change in a future specification version.    

The server MUST only allow peers to communicate to other peers connected via the same `relayId`.   

A mechanism for connection health checks is described in the "messaging" section below, which a server MUST follow.

## Messaging
All messages sent and received MUST be UTF-8 encoded JSON object conforming to the [message types](#message-type-reference) described below.  
The relay and peers SHOULD validate messages, and on malformed or unexpected messages, may choose to either ignore them or close the connection.

### Connection Checks (ping/pong)
In order to monitor connection health the server MUST send periodic `ping` messages to all peers. When receiving these, the connected peer MUST respond by sending a `pong` message.  
The server MUST determine that a connection is stale if the peer sends no pong replies or other messages for a given duration (exact value is at the discretion of the server), at which point it MUST close the connection.  

Peers MUST implement the same logic to monitor connection health with the server.  
When the server sends a `ping` message, the peer MUST respond by sending a `pong` message.  
If a peer determines that the connection is stale (no pong replies or other message from the server for a given duration) it MUST close the connection and attempt to reconnect.

The server MUST never relay `ping`/`pong` messages between peers, these are unique to each connection.

### Peer Discovery
When a peer connect or disconnects, the server MUST broadcast a `peers.list` message to all peers in the given relay, including the newly connected peer if applicable.
Peers may also choose to send a `peers.discover` message at any time, which the server MUST respond to by sending a `peers.list` message.   
When responding to a `peers.discover` message, the server MUST only send the reply to the requesting peer.

### Message Sending
A peer can send a message to peers using the `message` message. On receiving a message, the server MUST
attach the `from` property (the sending peers `peerId`) before broadcasting the message to all other connected peers.   
The sending peer MUST not be re-sent their own message.

A peer may send to a specific peer by setting the `to` property to a `peerId` value. The server MUST still
attach the `from` property and MUST retain the `to` property.  
The server MUST then send the message to the specific peer only.

On an invalid `peerId` value, the server may choose to either ignore the message or close the connection.

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
