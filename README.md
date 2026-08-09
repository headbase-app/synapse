# Synapse Relay Server
Synapse is a WebSocket relay server which allows peers to connect via a shared public-key identity and exchange messages.  

The [server protocol](/docs/specs/synapse-01.md) and implementation is designed to be application agnostic, however as part of Headbase its purpose is
to provide a mechanism for data synchronisation between peers.

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
