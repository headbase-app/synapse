# Synapse Relay Specification - `002`

WORK IN PROGRESS IDEAS

Specification 001 only has basic secret based authentication guarding the server itself, there is no auth for relays.  

A future update to the specification could introduce public/private key encryption where relays are identified via
public key and peers must prove ownership over the corresponding private key to connect.

An initial draft of this flow could be:
- Peer requests a connection token, which is a short-lived and signed JWT the server produces containing the public key and a cryptographically random challenge
- Peers then extract this challenge and sign it with their private key
- Peers send the token and their challenge response when connecting to the relay
- The JWT allows the server...
  - to generate challenges on the server which can be random each time but "scoped" to the server
  - this means there is no way a bad actor could gain access via data known to be signed via the private key
  - short expiry (10s or so) prevents long-lived tokens
  - stateless JWTs prevents the server needing to store data before a connection is made

There are still some potential issues here:
- JWTs are their own standard and introduce extra dependencies. Could a custom "token" encoding the same information be used instead? Does this give any major benefit?
- Servers may want to restrict access to a whitelist of public keys
- Servers would have to supply connection tokens to anyone who requested them, this would allow things like a bad actor being able to test the public keys allowed by the server
