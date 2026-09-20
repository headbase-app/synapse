# Synapse Relay Server
Synapse is a private WebSocket relay server with public/private key authentication, peer discovery and message channels.

The [server protocol](/docs/specs/synapse-01.md) and implementation are designed to be application agnostic, however this project is developed alongside Headbase with the goal of allowing data synchronisation between peers.

**Features:**
- Relays identified via public key and authenticated via public/private key encryption.
- Peer discovery and direct messaging supported within a relay.
- Channels allow peers to send and subscribe to a subset of messages.
- Tags allows peers to send and subscribe to a subset of messages within a channel.

## Usage
Docker is the only supported way of running a relay in production. You can learn more at [docs/user/self-hosting.md](./docs/user/self-hosting.md).

## Local Development

### Prerequisites
- Node.js and NPM (LTS)
- Docker (if testing docker builds)

### Setup

1. Install dependencies:
```
npm install
```

2. Configure environment variables (if desired, the server has defaults it will use):
```
cp .env.example .env
```

### Development

1. Run the app in dev mode:
```
npm start
```

2. Run tests:
```
npm run tests
```

3. Run a build:
```
npm run build
```

4. Run the build:
```
npm run start:build
```

## Contributions
This project is currently open source, not open contribution.
This is a personal project in its early stages. You're welcome to try it out, ask questions, raise bug reports etc but
it wouldn't be practical to accept external code contributions or feature requests yet.

I'm open to this changing in the future once the project is more stable, collaboration is one of the great things about open source after all!

## License
Headbase projects are released under the [GNU AGPLv3](https://choosealicense.com/licenses/agpl-3.0/) licence.
