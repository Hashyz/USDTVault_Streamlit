# BEP20 USDT Savings & Portfolio Management Platform

## Overview

This is a web-based cryptocurrency portfolio management platform focused on BEP20 USDT (Binance Smart Chain) savings and transactions. The application enables users to securely manage their USDT holdings using imported private keys, track transactions, set savings goals, create investment plans, and monitor their financial progress through an intuitive dashboard.

The platform combines traditional financial planning features (savings goals, investment plans) with cryptocurrency wallet functionality (send/receive USDT, transaction tracking) in a user-friendly interface inspired by Binance's design language.

## Current Status (November 13, 2025)

**Completed Features:**
- ✅ **REAL CRYPTOCURRENCY WALLET** - Direct private key import for full wallet control
- ✅ **Binance Smart Chain Support** - Connect to BSC Mainnet for real transactions
- ✅ **Real BNB & USDT Transactions** - Send and receive actual crypto with gas estimation
- ✅ **Live Blockchain Data** - Real-time balance updates from the blockchain
- ✅ **BEP20 USDT Support** - Full smart contract integration (0x55d398326f99059ff775485246999027b3197955)
- ✅ **Transaction Confirmation** - Gas fee preview and BSCScan links
- ✅ **Network Management** - Automatic BSC Mainnet connection
- ✅ Full MongoDB integration with Mongoose models
- ✅ JWT-based authentication with secure password hashing (bcrypt)
- ✅ AES-encrypted credential export/import functionality
- ✅ Demo mode for testing (username: "demo", password: "demo123")
- ✅ All pages implemented (Dashboard, Savings Goals, Transactions, Investment Plans, Settings)
- ✅ Binance-inspired UI design with gold (#F0B90B) accent colors
- ✅ **PIN Security System** - 6-digit PIN protection for sensitive operations
- ✅ **Enhanced Credential Export** - Option to include encrypted private key with PIN protection
- ✅ **Real Balance Chart** - Dashboard chart now shows actual balance history from transactions
- ✅ **Transaction History** - Fully functional transaction display with proper data mapping
- ✅ **Financial Data Normalization** - Decimal.js integration for high-precision cryptocurrency amounts
- ✅ **String-Based Financial Processing** - All monetary values handled as strings to prevent precision loss
- ✅ **Create-Delete-Create Bug Fixed** - Resolved "Expected string, received number" validation errors
- ✅ **Deposit Functionality** - Working deposit flow with proper string-to-number conversion

**Web3 Wallet Features:**
- Direct private key import for secure wallet management
- Real BNB balance from blockchain
- Real USDT (BEP20) balance from smart contract
- Send BNB with gas estimation
- Send USDT tokens via smart contract
- Transaction hash tracking
- BSCScan integration for transaction/address exploration
- Automatic BSC Mainnet connection
- Demo mode for testing without real funds

**Important Security Note:**
This is now a REAL cryptocurrency wallet. Users can send and receive actual BNB and USDT on the Binance Smart Chain. Always verify addresses before sending funds.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tools**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR and optimized production builds
- Wouter for lightweight client-side routing (alternative to React Router)

**UI Component System**
- Radix UI primitives for accessible, unstyled base components (dialogs, dropdowns, tooltips, etc.)
- Tailwind CSS for utility-first styling with a custom design system
- Shadcn/ui component architecture following the "New York" style preset
- Custom theme system supporting light/dark modes with CSS variables
- Design inspired by Binance (cryptocurrency exchange) and MetaMask (wallet) interfaces

**State Management**
- TanStack Query (React Query) for server state management, caching, and API synchronization
- Local state with React hooks (useState, useEffect) for UI-specific state
- Form state managed by React Hook Form with Zod validation schemas

**Key Design Decisions**
- Cryptocurrency-focused color palette: Binance gold (#F0B90B) for primary actions, crypto green (#0ECB81) for profits, and red (#F6465D) for losses
- Monospace fonts (Roboto Mono) for displaying wallet addresses and USDT amounts to ensure readability
- Mobile-first responsive design with collapsible sidebar navigation
- Component library organized with example files for documentation and testing

### Backend Architecture

**Server Framework**
- Express.js as the HTTP server framework
- TypeScript for type safety across the entire stack
- Custom Vite middleware integration for seamless development experience

**Authentication & Security**
- JWT (JSON Web Tokens) for stateless authentication
- Bcrypt for password hashing before storage
- Token-based authorization middleware protecting all API routes
- Encrypted credential storage capability for wallet private keys (using crypto-js)

**API Design**
- RESTful API endpoints organized by domain:
  - `/api/auth/*` - User registration, login, token verification
  - `/api/wallet/*` - Balance queries and wallet operations
  - `/api/transactions/*` - Transaction history and management
  - `/api/savings-goals/*` - CRUD operations for savings goals
  - `/api/investment-plans/*` - CRUD operations for investment plans
  - `/api/credentials/*` - Encrypted credential export/import

**Data Layer Abstraction**
- Storage interface pattern (`IStorage`) for database operations
- In-memory implementation (`MemStorage`) for development and testing
- Database-agnostic design allowing easy migration to PostgreSQL with Drizzle ORM

### Database Schema

**Database Technology**
- Configured for PostgreSQL via Drizzle ORM
- Neon serverless PostgreSQL in production
- Connection pooling with `@neondatabase/serverless`

**Schema Design**

*Users Table*
- Primary key: UUID generated by database
- Fields: username (unique), hashed password, wallet address, balance (numeric precision 20,8), encrypted credentials
- Balance stored as high-precision decimal to handle cryptocurrency micro-amounts

*Transactions Table*
- Foreign key reference to users table
- Transaction type: enum (send/receive)
- Amount: numeric with 8 decimal places for USDT precision
- Status tracking: pending/completed/failed for async blockchain operations
- Destination/source address storage

*Savings Goals Table*
- User-specific financial targets
- Current amount vs. target amount tracking
- Deadline timestamps for goal completion
- Progress calculation support

*Investment Plans Table*
- Automated recurring investment configurations
- Frequency options: weekly/monthly
- Auto-invest toggle for automated execution
- Next contribution date tracking

**Key Schema Decisions**
- All monetary values use `numeric(20, 8)` to prevent floating-point precision errors common in financial applications
- UUID primary keys for security and scalability
- Timestamp fields with timezone awareness using PostgreSQL's timestamp type
- Zod schemas generated from Drizzle table definitions for runtime validation consistency

### External Dependencies

**Cryptocurrency & Blockchain**
- No direct blockchain integration in current implementation
- Architecture prepared for Web3 wallet integration (MetaMask, WalletConnect)
- Wallet address storage and transaction simulation capabilities
- BEP20 (Binance Smart Chain) focus indicated in design specifications

**UI Component Libraries**
- Radix UI suite: 25+ primitive components for accessible UI patterns
- Recharts for data visualization (balance charts, portfolio trends)
- Lucide React for consistent iconography
- date-fns for date formatting and manipulation

**Development & Build Tools**
- Vite plugins for Replit integration (@replit/vite-plugin-runtime-error-modal, cartographer, dev-banner)
- PostCSS with Autoprefixer for CSS processing
- ESBuild for server-side bundling in production

**Database & ORM**
- Drizzle ORM for type-safe database queries
- Drizzle Kit for schema migrations
- Neon serverless PostgreSQL driver
- connect-pg-simple for session storage (PostgreSQL session store)

**Authentication & Validation**
- jsonwebtoken for JWT generation and verification
- bcryptjs for password hashing
- Zod for schema validation across frontend and backend
- @hookform/resolvers for integrating Zod with React Hook Form

**Key Dependency Decisions**
- Wouter chosen over React Router for smaller bundle size in cryptocurrency app context
- TanStack Query provides automatic refetching for real-time balance updates
- Drizzle ORM selected for TypeScript-first approach and lightweight runtime
- In-memory storage implementation allows development without database setup while maintaining production-ready interface