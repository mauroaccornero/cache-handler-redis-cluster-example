# Next.js Redis Cluster Cache Integration Example

Run docker compose to start redis locally

```
docker-compose up -d
```

open redis-1 terminal and create the cluster

```
redis-cli --cluster create 172.38.0.11:6379 172.38.0.12:6379 172.38.0.13:6379 172.38.0.14:6379 172.38.0.15:6379 172.38.0.16:6379 --cluster-replicas 1
```

type "yes" to apply the configuration.

verify that the cluster was created

```
redis-cli -c
cluster nodes
```

install next.js dependencies for the project

```
npm i
```

build next.js (will not use custom redis cache handler during build)

```
npm run build
```

start next.js app

```
npm run start
```

navigate to the local homepage [http://localhost:3000/cet](http://localhost:3000/cet) 

to remove logs, remove NEXT_PRIVATE_DEBUG_CACHE=1 from package.json

keep in mind that redis data will be stored in redis/node-X/data

to flush all the redis cluster use 

```
redis-cli --cluster call --cluster-only-masters 172.38.0.11:6379 FLUSHALL
```