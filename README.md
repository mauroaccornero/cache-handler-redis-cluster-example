# Next.js Redis Cluster Cache Integration Example

This example demonstrates how to integrate a Redis Cluster Cache with a Next.js application.

## Prerequisites

- **Debian-based OS**: Ensure your operating system is Debian-based (e.g., Ubuntu, Debian).
- **Docker**: Ensure Docker is installed on your machine.
- **Node.js**: Ensure Node.js (and npm) is installed on your machine.

### Windows and MacOS Users

MacOS and Windows users can use [Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers) to run the example in a containerized environment. This project includes a `devcontainer.json` file that defines the container image and the necessary dependencies.

## Getting Started

### Step 1: Start Redis Using Docker Compose

To start Redis locally, run:

```sh
docker-compose up -d
```

### Step 2: Install Project Dependencies

Install the necessary Next.js dependencies:

```sh
npm i
```

### Step 3: Build the Next.js Application

Build the Next.js application. Note that the custom Redis cache handler will not be used during the build process:

```sh
npm run build
```

### Step 4: Start the Next.js Application

Start the Next.js application:

```sh
npm run start
```

### Step 5: Access the Application

Navigate to the local homepage in your browser:

http://localhost:3000

Then navigate through the different timezones to see the cache in action.

## Logging Configuration

To remove logs, edit the package.json file by removing `NEXT_PRIVATE_DEBUG_CACHE=1`.

## Redis Cluster Management

### Redis Data Storage

Redis data will be stored in `redis/node-X/data`.

### Flushing the Redis Cluster

To flush all data from the Redis cluster, use the following commands:

Enter the Docker container:

```sh
docker exec -it cache-handler-redis-cluster-example-redis-1-1 /bin/bash
```

Flush all Redis nodes:

```sh
redis-cli --cluster call --cluster-only-masters 172.38.0.11:6379 FLUSHALL
```
