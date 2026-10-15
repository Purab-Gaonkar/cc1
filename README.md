# E-Commerce Architecture Lab: Monolithic vs Microservices

A production-grade cloud computing and software engineering laboratory project demonstrating and comparing two complete, fully functional E-Commerce applications built under contrasting paradigms:
1. **Unified Monolithic Architecture** (`Port 5000`)
2. **Decentralized Microservices Architecture** (`Ports 8000–8004`)

Both applications feature an identical tech catalog, dynamic shopping cart, discount coupon processing, checkout workflows, order history, and integrated architectural diagnostic consoles.

---

## 📸 Interactive Visual Gallery & Screenshots

- **Interactive Gallery**: Open [screenshots/screenshots.html](file:///c:/Users/Student/Documents/CC1/screenshots/screenshots.html) in any browser for an interactive side-by-side presentation deck with tabbed views.
- **Markdown Showcase**: Complete photographic documentation is available in [screenshots/SCREENSHOTS.md](file:///c:/Users/Student/Documents/CC1/screenshots/SCREENSHOTS.md).

| Monolithic Application (`:5000`) | Microservices Application (`:8000`) |
| :---: | :---: |
| ![Monolith Storefront](screenshots/monolithic/01-monolithic-storefront.png) | ![Microservices Storefront](screenshots/microservices/01-microservices-storefront.png) |
| *Single-Tier Unified Express Server with In-Memory ACID Invocations* | *API Gateway Routing to 4 Autonomous Services with Database-per-Service* |

---

## 🏛️ 1. Monolithic E-Commerce Application

### Architecture Overview
The Monolithic application runs as a **single cohesive Node.js/Express process** listening on **Port 5000**. All business modules share process memory and interact directly with a **single centralized SQLite database** (`monolith_ecommerce.db`).

```
                    ┌───────────────────────────────────────────────┐
                    │               Client Browser                  │
                    │      (HTML5 / Vanilla CSS / Modern SPA)       │
                    └───────────────────────┬───────────────────────┘
                                            │ HTTP Port 5000
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                           Unified Monolithic Express Server (PID: xxxx)                   │
│                                                                                           │
│   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌────────┐   │
│   │   Auth & Session   │   │  Product Catalog   │   │    Shopping Cart   │   │ Orders │   │
│   │     Controller     │   │     Controller     │   │     Controller     │   │ & Svc  │   │
│   └─────────┬──────────┘   └─────────┬──────────┘   └─────────┬──────────┘   └───┬────┘   │
│             │                        │                        │                  │        │
│             └────────────────────────┴────────┬───────────────┴──────────────────┘        │
│                                               │ Direct In-Memory ACID Invocations         │
│                                               ▼                                           │
│                            ┌──────────────────────────────────────┐                       │
│                            │   Central Embedded SQLite Engine     │                       │
│                            │      (monolith_ecommerce.db)         │                       │
│                            └──────────────────────────────────────┘                       │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Characteristics
- **Shared Database**: All domain tables (`users`, `products`, `cart`, `orders`, `order_items`, `payments`) exist in one SQL schema.
- **ACID Transactions**: Checkout executes inside a native `BEGIN TRANSACTION ... COMMIT` block. Inventory decrement, payment capture, and order creation occur atomically without two-phase commit overhead.
- **Zero Inter-Service Latency**: Module calls execute in RAM (`< 0.5 ms`).
- **Single Point of Failure**: An unhandled exception or memory leak in one controller halts the entire application.

---

## 🌐 2. Microservices E-Commerce Application

### Architecture Overview
The Microservices application decomposes the e-commerce domain into **5 independent processes** communicating over HTTP REST with an **API Gateway** as the single entry point.

```
                                    ┌──────────────────────┐
                                    │    Client Browser    │
                                    └──────────┬───────────┘
                                               │ Port 8000
                                               ▼
                        ┌───────────────────────────────────────────────┐
                        │             API Gateway Core (:8000)          │
                        │    Reverse Proxy, Tracing & Topology Registry │
                        └───────┬──────────┬──────────┬──────────┬──────┘
       /api/products/*          │          │          │          │  /api/payments/*
        ┌───────────────────────┘          │          │          └───────────────────────┐
        ▼                                  ▼          ▼                                  ▼
┌──────────────────────┐    ┌─────────────────────┐  ┌──────────────────────┐   ┌──────────────────────┐
│  Product Microservice│    │  User Microservice  │  │   Order Microservice │   │ Payment Microservice │
│      (Port 8001)     │    │     (Port 8002)     │  │      (Port 8003)     │   │      (Port 8004)     │
│   product_service.db │    │   user_service.db   │  │    order_service.db  │   │   payment_service.db │
└──────────────────────┘    └─────────────────────┘  └──────────┬───────────┘   └──────────▲───────────┘
                                                                │                          │
                                                                └─ Distributed Saga RPC ───┘
```

### Microservice Registry & Ports

| Service Name | Port | Database File | Primary Responsibilities |
| :--- | :---: | :--- | :--- |
| **API Gateway Core** | `8000` | In-Memory Ring Buffer | Reverse proxy routing, correlation ID injection, service health monitoring |
| **Product Catalog Service** | `8001` | `product_service.db` | Catalog browsing, category filtering, inventory management |
| **User & Auth Service** | `8002` | `user_service.db` | Customer authentication, credentials, profiles |
| **Order & Cart Service** | `8003` | `order_service.db` | Cart sessions, distributed Saga checkout orchestrator |
| **Payment Service** | `8004` | `payment_service.db` | Payment transaction authorizations, audit ledger |

### Distributed Saga Pattern (Checkout Orchestration)
Because databases are isolated, atomic SQL transactions are impossible across microservices. Instead, the **Order Microservice** acts as an orchestrator:
1. Reads cart items from local `order_service.db`.
2. Makes an HTTP `PUT /products/:id/stock` request to **Product Service** (`:8001`) with `X-Correlation-ID`.
3. Makes an HTTP `POST /payments/charge` request to **Payment Service** (`:8004`) with `X-Correlation-ID`.
4. Commits order locally to `order_service.db` with the payment transaction reference.
5. Emits distributed telemetry logs tracked end-to-end.

---

## ⚖️ Deep Architectural Comparison

| Dimension | 🏛️ Monolithic Architecture | 🌐 Microservices Architecture |
| :--- | :--- | :--- |
| **Process Count** | 1 unified process (`Port 5000`) | 5 autonomous processes (`Ports 8000–8004`) |
| **Database Strategy** | Shared database (`monolith_ecommerce.db`) | Database-per-service pattern (4 isolated SQLite DBs) |
| **Inter-Service Latency** | Direct in-memory invocation (`< 0.5 ms`) | Network HTTP RPC via Gateway (`3.5 – 8.0 ms`) |
| **Data Consistency** | Strong ACID (single `BEGIN ... COMMIT`) | Eventual Consistency via Distributed Saga Orchestration |
| **Scalability** | Scale the entire monolith horizontally or vertically | Granular scaling (e.g. scale Product Service independently) |
| **Fault Isolation** | Low (bug in Payment module crashes whole app) | High (Payment service downtime does not prevent Catalog browse) |
| **Technology Freedom** | Single language & runtime lock-in | Polyglot (each service can choose its own language/framework) |
| **Tracing & Debugging** | Single call stack trace | Requires Correlation IDs (`X-Correlation-ID`) across hops |
| **Deployment Overhead** | Simple 1-command artifact deployment | Requires service discovery, proxying, and container mesh |

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18+ or v24+ recommended)
- Windows PowerShell or Command Prompt

### Option A: Using 1-Click Batch Launchers (Recommended)
- **Start Monolithic App**: Double click `start-monolith.bat` &rarr; Opens `http://localhost:5000`
- **Start Microservices Cluster**: Double click `start-microservices.bat` &rarr; Opens `http://localhost:8000`
- **Stop All Running Servers**: Double click `stop-all.bat`

### Option B: Manual Command Line Execution

#### Running the Monolithic Application
```powershell
cd monolithic-ecommerce
npm install
node server.js
# Access at http://localhost:5000
```

#### Running the Microservices Ecosystem
```powershell
cd microservices-ecommerce
npm install
node start-all-services.js
# Access at http://localhost:8000
```

---

## 📡 Key REST API Specifications

### Monolithic Endpoints (`http://localhost:5000`)
- `GET  /api/health` — System status, PID, memory, and monolithic characteristics
- `GET  /api/products` — Product catalog with category and search query parameters
- `GET  /api/cart?userId=1` — In-process shopping cart retrieval
- `POST /api/cart/add` — Add product to cart
- `POST /api/checkout` — Atomic in-process checkout transaction
- `GET  /api/orders?userId=1` — Order history
- `GET  /api/monolith/diagnostics` — Telemetry, DB row counts, and live execution traces

### Microservices Gateway Endpoints (`http://localhost:8000`)
- `GET  /api/gateway/topology` — Real-time health, port status, and ping latencies of all 4 microservices
- `GET  /api/gateway/traces` — Rolling buffer of distributed request traces with correlation IDs
- `GET  /api/products` — Routed downstream to Product Service (`:8001`)
- `POST /api/auth/login` — Routed downstream to User Service (`:8002`)
- `GET  /api/cart` — Routed downstream to Order Service (`:8003`)
- `POST /api/orders/checkout` — Initiates distributed Saga across `:8003`, `:8001`, and `:8004`
- `GET  /api/orders` — Routed downstream to Order Service (`:8003`)
- `GET  /api/payments/history` — Routed downstream to Payment Service (`:8004`)
