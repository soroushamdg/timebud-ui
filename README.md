# TimeBud

**Your intelligent focus companion for time management and productivity**

TimeBud is a modern web application that helps users manage their time effectively through AI-powered task planning, focus sessions, and intelligent scheduling. Built with Next.js, React, and Supabase, it combines a beautiful user interface with powerful productivity features.

---

## 🎯 What TimeBud Does

TimeBud is an intelligent time management application that helps you:
- **Plan your day** using AI-powered task scheduling algorithms
- **Focus on what matters** with distraction-free work sessions
- **Track your progress** across projects and tasks
- **Stay organized** with GTD-inspired project management
- **Get AI assistance** for task creation, planning, and productivity insights

The app uses a sophisticated planning algorithm that considers task priorities, deadlines, dependencies, and your available time to create optimal daily schedules.

---

## ✨ Key Features

### 🤖 AI-Powered Capabilities
- **Multi-Provider AI Chat Assistant** - Integrated support for OpenAI, Anthropic Claude, and Google Gemini
- **Intelligent Task Planning** - Automatic session planning based on priorities, deadlines, and dependencies
- **AI Tool Execution** - Create tasks, projects, and manage your workflow through natural language
- **Smart Scheduling Algorithm** - Optimizes task allocation based on available time and constraints

### 📊 Project & Task Management
- **GTD-Inspired Organization** - Projects with tasks, milestones, and dependencies
- **Advanced Filtering** - Filter by project, priority, deadline, and completion status
- **Task Dependencies** - Link tasks together for proper sequencing
- **Bulk Operations** - Generate multiple tasks at once with AI assistance
- **Custom Project Avatars** - LEGO-style avatars with image upload support

### ⏱️ Focus Sessions
- **Timed Work Sessions** - Structured focus periods with task allocation
- **Session Management** - Pause, resume, and adjust session times
- **Task Overview** - See what's planned for your session
- **Automatic Re-planning** - Dynamically adjusts when tasks or settings change
- **Unfinished Session Recovery** - Resume where you left off

### 💳 Credits & Billing System
- **Credit-Based AI Usage** - Fair pricing for AI features
- **Stripe Integration** - Secure payment processing for credit packs
- **Pro Subscription** - Higher monthly allowances for power users
- **Free Monthly Credits** - 300 credits/month for free tier users
- **Transparent Pricing** - All costs stored in Stripe metadata (no hardcoding)

### 🎨 User Experience
- **Progressive Web App (PWA)** - Install on mobile and desktop
- **Tab Bar Navigation** - Mobile-friendly bottom navigation
- **Swipe Gestures** - Complete, prioritize, or delete tasks with gestures
- **Dark Mode** - Beautiful dark theme throughout
- **Responsive Design** - Works seamlessly on all devices
- **Loading States** - Smooth transitions and progress indicators

### 🔐 Authentication & Security
- **Supabase Authentication** - Secure user management
- **Row Level Security (RLS)** - Database-level access control
- **Webhook Signature Verification** - Secure Stripe integration
- **Server-Side API Keys** - No sensitive data exposed to client

---

## 💼 Resume Summary

### What I Built

Developed **TimeBud**, a full-stack productivity application that combines intelligent task planning with AI-powered assistance. The application features a sophisticated scheduling algorithm, real-time collaboration capabilities, and a complete monetization system.

**Key Achievements:**
- Architected and implemented a **custom task scheduling algorithm** that optimizes daily plans based on priorities, deadlines, dependencies, and available time
- Built a **multi-provider AI chat system** integrating OpenAI, Anthropic, and Google Gemini with tool execution capabilities for task/project management
- Designed and deployed a **complete credit-based billing system** using Stripe, including webhook handling, subscription management, and atomic credit transactions
- Implemented **Progressive Web App (PWA)** functionality with offline support and mobile installation
- Created a **custom avatar system** with image upload, cropping, and LEGO-style project avatars
- Developed comprehensive **authentication and authorization** using Supabase with row-level security

**Technical Stack:**
- **Frontend:** Next.js 16, React 19, TypeScript, TailwindCSS, Zustand
- **Backend:** Supabase (PostgreSQL), Edge Functions, Row Level Security
- **AI Integration:** OpenAI GPT-4, Anthropic Claude, Google Gemini
- **Payments:** Stripe Checkout, Subscriptions, Webhooks
- **Tools:** React Query, date-fns, Lucide Icons, React Easy Crop

**Core Competencies Demonstrated:**
- Full-stack web development with modern frameworks
- Complex algorithm design and optimization
- Third-party API integration (AI providers, payment processing)
- Database design with PostgreSQL and RLS policies
- State management and real-time updates
- Responsive UI/UX design with mobile-first approach
- Secure authentication and authorization flows
- Webhook handling and event-driven architecture

---

## 📅 Development Timeline

### **March 2026 - Phase 7: Advanced Features & Polish**

#### Week of March 10-13
- **Custom Avatar System** - Implemented image upload with cropping, LEGO-style project avatars, and avatar management
- **Authentication Troubleshooting** - Added comprehensive debugging guides and system prompt templates
- **Credits & Billing System** - Complete Stripe integration with subscriptions, one-time purchases, webhook handling, and credit management
  - *Learning:* Stripe webhooks require careful signature verification and idempotent handling
  - *Architecture Decision:* Store all pricing in Stripe metadata to enable business changes without code deployments

#### Week of March 9-12
- **AI Chat Assistant** - Multi-provider support (OpenAI, Claude, Gemini) with tool execution for task/project creation
- **Project Deletion** - Implemented safe deletion with confirmation flows
- **Task Overview Dialog** - Added session planning preview
- **Planner Algorithm Refinement** - Simplified and improved task scheduling logic
  - *Pivot:* Moved from complex multi-factor scoring to clearer priority-based allocation
  - *Learning:* Simpler algorithms are easier to debug and often perform better

#### Week of March 9-10
- **All Tasks Page** - Comprehensive task management with advanced filtering, sorting, and bulk operations
- **Automatic Re-planning** - Dynamic session updates when tasks or UI settings change
- **Project View Enhancements** - Swipe gestures, hover states, and comprehensive editing
- **Deadline Management** - Visual indicators and smart date formatting
- **Loading Screen Fixes** - Resolved authentication loading issues

#### Early March (March 6-9)
- **Milestone Consolidation** - Merged milestones into tasks for simpler data model
  - *Pivot:* Removed standalone milestone page in favor of task-based approach
  - *Learning:* Fewer entities = simpler mental model for users
- **PWA Implementation** - Added Progressive Web App support for mobile installation
- **Tab Bar Navigation** - Mobile-friendly bottom navigation system
- **UI Polish** - Priority indicators, custom favicon, icon updates, time formatting improvements
- **Session Management** - Timer functionality, session ending flows, time adjustment dialogs

### **March 2026 - Phase 4-6: Core Application**

#### Week of March 3-6
- **Fresh UI Redesign** - Complete visual overhaul with modern design system
  - *Pivot:* Restarted UI from scratch for better UX
- **Complete Time Tracking** - Full authentication flow, session tracking, and user management
- **Work Session UI** - Phase 6 implementation with timer and task completion
- **Home Dashboard** - GTD project form and project detail pages
- **Keyboard Shortcuts** - Added productivity shortcuts throughout app
- **Backend Integration** - Supabase authentication and database setup
  - *Learning:* Proper authentication middleware is critical for security

### **Early March 2026 - Foundation**

#### Initial Development (March 3)
- **Project Initialization** - Next.js setup with TypeScript and TailwindCSS
- **Database Schema** - Designed PostgreSQL schema for users, projects, tasks, sessions
- **Authentication System** - Implemented Supabase auth with RLS policies
- **Core Components** - Built foundational UI components and layout system

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account
- Stripe account (for billing features)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd timebud-ui

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase and Stripe credentials

# Run development server
npm run dev
```

### Stripe Webhook Development

```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Listen to Stripe webhooks
npm run stripe:listen
```

Copy the webhook signing secret from the CLI output to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

---

## 📚 Documentation

- **[Credits System](./CREDITS_SYSTEM.md)** - Complete documentation of the billing and credits architecture
- **[Action Credit Deduction Guide](./new_action_credit_deduction_implementation_guide.txt)** - How to integrate credits into new features

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS 4
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **State Management:** Zustand + React Query
- **AI Providers:** OpenAI, Anthropic, Google Gemini
- **Payments:** Stripe
- **Icons:** Lucide React, Heroicons
- **PWA:** Serwist

---

## 📝 License

Private project - All rights reserved

---

## 🙏 Acknowledgments

Built with modern web technologies and a focus on user experience and developer productivity.
