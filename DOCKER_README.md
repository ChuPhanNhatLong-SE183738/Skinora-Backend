# Skinora Backend Docker Setup

## Prerequisites

- Docker Engine 20.x or later
- Docker Compose 2.x or later
- At least 4GB RAM available for containers

## Quick Start

1. **Clone and setup environment:**

   ```bash
   cd Skinora-Backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Build and start services:**

   ```bash
   # Using Makefile (recommended)
   make build
   make up

   # Or using docker-compose directly
   docker-compose -f docker-compose.glibc-2gb.yml build
   docker-compose -f docker-compose.glibc-2gb.yml up -d
   ```

3. **Check status:**

   ```bash
   docker-compose -f docker-compose.glibc-2gb.yml ps
   ```

4. **View logs:**
   ```bash
   make logs
   # Or
   docker-compose -f docker-compose.glibc-2gb.yml logs -f
   ```

## Available Commands

### Using Makefile

- `make help` - Show all available commands
- `make build` - Build Docker images
- `make up` - Start all services in production mode
- `make down` - Stop all services
- `make restart` - Restart all services
- `make logs` - View logs from all services
- `make clean` - Clean up containers and volumes
- `make dev` - Start in development mode
- `make app-logs` - View application logs only
- `make shell-app` - Access application container shell

### Development Mode

For development with hot reload:

```bash
make dev
# Or
docker-compose -f docker-compose.glibc-2gb.yml -f docker-compose.dev.yml up -d
```

## Services

The stack includes:

- **App**: NestJS application (Port 3000)
- **MongoDB**: Database (Port 27017)
- **Redis**: Cache/Session store (Port 6379)
- **Nginx**: Reverse proxy (Port 80/443)

## Environment Variables

Key environment variables in `.env`:

```env
# Application
NODE_ENV=production
PORT=3000
JWT_SECRET=your-jwt-secret

# Database
MONGODB_URI=mongodb://admin:password@mongo:27017/skinora?authSource=admin
MONGO_USERNAME=admin
MONGO_PASSWORD=password

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
```

## Data Persistence

- MongoDB data: `mongo_data` volume
- Redis data: `redis_data` volume
- Uploads: `./uploads` directory (bind mount)
- Models: `./models` directory (bind mount)

## Resource Limits

Default resource limits:

- App: 2GB RAM, 1 CPU
- MongoDB: 1GB RAM, 0.5 CPU
- Redis: 512MB RAM, 0.25 CPU

## Health Checks

The application includes health checks:

- Endpoint: `http://localhost:3000/health`
- Interval: 30 seconds
- Timeout: 3 seconds

## Troubleshooting

### Common Issues

1. **Port conflicts:**

   ```bash
   # Check what's using the port
   netstat -an | findstr :3000

   # Change ports in docker-compose.yml if needed
   ```

2. **Memory issues:**

   ```bash
   # Check container memory usage
   docker stats

   # Adjust memory limits in docker-compose.yml
   ```

3. **Database connection issues:**

   ```bash
   # Check MongoDB logs
   make mongo-logs

   # Access MongoDB shell
   make shell-mongo
   ```

### Logs and Debugging

```bash
# View specific service logs
docker-compose -f docker-compose.glibc-2gb.yml logs app
docker-compose -f docker-compose.glibc-2gb.yml logs mongo
docker-compose -f docker-compose.glibc-2gb.yml logs redis

# Follow logs in real-time
docker-compose -f docker-compose.glibc-2gb.yml logs -f app

# Access container shell
docker-compose -f docker-compose.glibc-2gb.yml exec app sh
```

## Production Deployment

For production deployment:

1. **Setup SSL certificates:**

   ```bash
   # Place SSL certificates in docker/ssl/
   # Update nginx.conf for HTTPS
   ```

2. **Configure environment:**

   ```bash
   # Use production values in .env
   NODE_ENV=production
   # Strong JWT secret
   # Secure database passwords
   ```

3. **Deploy:**
   ```bash
   make build
   make prod
   ```

## Backup and Restore

### MongoDB Backup

```bash
make backup-mongo
```

### MongoDB Restore

```bash
make restore-mongo
```

## Scaling

To scale the application:

```bash
# Scale app instances
docker-compose -f docker-compose.glibc-2gb.yml up -d --scale app=3

# Use load balancer (update nginx.conf)
```
