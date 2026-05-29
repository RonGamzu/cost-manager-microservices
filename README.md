# Cost Manager - RESTful Web Services

Final project for the course. The system is built as four independent
Node.js microservices that share the same MongoDB Atlas database.

## Services

| Service | Default port | Endpoints |
|---|---|---|
| logs-service | 3001 | `GET /api/logs` |
| users-service | 3002 | `GET /api/users`, `GET /api/users/:id`, `POST /api/add` |
| costs-service | 3003 | `POST /api/add`, `GET /api/report` |
| about-service | 3004 | `GET /api/about` |

Each service has its own `.env` file with `HOST`, `PORT` and `MONGODB_URI`.

## Installation

The four services are wired together as npm workspaces, so a single
install at the repository root takes care of every service:

```
npm install
```

The command places all dependencies in the root `node_modules` folder.
Each service still has its own `package.json` and runs as an
independent process.

## Filling the environment files

Edit the `.env` file inside every service and replace the placeholder
`MONGODB_URI` with the real Atlas connection string. Keep the same
connection string in every `.env` so all four services share the same
database.

Example `.env`:

```
HOST=localhost
PORT=3003
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
```

## Seeding the database

The submission requires the database to be empty except for one user.
Run the seeder once from the repository root:

```
node seed.js
```

The seeder reads `MONGODB_URI` from `costs-service/.env`, drops the
`users`, `costs`, `logs` and `reports` collections and then inserts a
single user document:

```
{ id: 123123, first_name: 'mosh', last_name: 'israeli' }
```

## Running the services

Open four terminals and start every service:

```
node logs-service/index.js
node users-service/index.js
node costs-service/index.js
node about-service/index.js
```

Every service prints the address it listens on.

## Running the unit tests

Each service ships its own Jest suite. From the repository root run:

```
npm test
```

To execute only one suite:

```
npm run test:about
npm run test:logs
npm run test:users
npm run test:costs
```

The tests use `mongodb-memory-server`, so they do not touch the Atlas
database and do not require a network connection.

## Passing the automated Python grader

The Python script that grades the project sends requests to URLs that
end with a trailing slash (`/api/about/`, `/api/add/`, `/api/report/`).
The Express applications are configured with `strict routing` disabled,
so both `/api/about` and `/api/about/` reach the same handler.

Fill the four base URLs at the top of the Python script with the four
service addresses, for example:

```
a = 'http://localhost:3001'   # logs service
b = 'http://localhost:3002'   # users service
c = 'http://localhost:3003'   # costs service
d = 'http://localhost:3004'   # about service
```
