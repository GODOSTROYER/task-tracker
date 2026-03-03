# System Architecture

This document outlines the high-level architecture, data flow, and core models of the Mini Task Tracker application.

## Overview

The application follows a decoupled client-server architecture:

- **Frontend**: A Next.js 15 application utilizing React 19 and the App Router.
- **Backend**: A Node.js Express server providing a RESTful API.
- **Database**: MongoDB for persistent data storage using Mongoose ODM.
- **Cache**: Redis for caching API responses and improving read performance.

## System Architecture Diagram

```mermaid
graph TD
    Client[Client Browser] -->|HTTP / React UI| Frontend[Next.js Frontend]
    Frontend -->|REST API Calls| Backend[Express Backend]

    Backend -->|Mongoose queries| DB[(MongoDB)]
    Backend -->|Cache reads/writes| Cache[(Redis)]

    Backend -->|SMTP Email| Email[Gmail SMTP]
```

## Data Models

The system relies on three primary data models:

1. **User**: Stores authentication details, hashed passwords, and email verification status.
2. **Task**: Represents an individual task item with properties like title, status, and ownership references.
3. **Workspace**: A grouping concept (optional based on schema) allowing tasks to be organized into distinct project spaces.

### Database Schema Relationships

```mermaid
erDiagram
    USER ||--o{ TASK : "owns"
    USER ||--o{ WORKSPACE : "member of"
    WORKSPACE ||--o{ TASK : "contains"

    USER {
        ObjectId _id
        String email
        String password
        Boolean isVerified
    }

    TASK {
        ObjectId _id
        String title
        String description
        String status
        ObjectId owner
        ObjectId workspaceId
    }

    WORKSPACE {
        ObjectId _id
        String name
        ObjectId owner
    }
```

## Authentication Flow

The application uses an asynchronous JWT-based authentication flow with email verification.

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant DB
    participant Email Engine

    User->>Client: Enters Signup Details
    Client->>API: POST /api/auth/signup
    API->>DB: Create User (isVerified: false)
    API->>Email Engine: Send 6-digit OTP
    API-->>Client: 201 Created (Requires Verification)

    User->>Client: Enters OTP
    Client->>API: POST /api/auth/verify-email
    API->>DB: Mark User Verified
    API-->>Client: 200 OK

    User->>Client: Enters Credentials
    Client->>API: POST /api/auth/login
    API->>DB: Verify Credentials
    API-->>Client: Return JWT Token
```

## Task Management Flow (with Caching)

To optimize performance, task fetching is heavily reliant on Redis.

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Redis
    participant DB

    Client->>API: GET /api/tasks (with JWT)
    API->>Redis: Check Cache for User Tasks

    alt Cache Hit
        Redis-->>API: Return Cached Tasks
        API-->>Client: 200 OK (Tasks Data)
    else Cache Miss
        Redis-->>API: None
        API->>DB: Query Tasks for User
        DB-->>API: Task Data
        API->>Redis: Set Cache (Tasks Data)
        API-->>Client: 200 OK (Tasks Data)
    end

    %% Mutation Example
    Client->>API: POST /api/tasks (Create Task)
    API->>DB: Intert New Task
    DB-->>API: Confirmation
    API->>Redis: Invalidate User Task Cache
    API-->>Client: 201 Created
```
