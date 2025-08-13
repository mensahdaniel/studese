# StudEse

StudEse is a productivity web application designed to simplify campus life for students. Built with React, TypeScript, Vite, Supabase, shadcn-ui, and Tailwind CSS, it provides a dashboard to manage classes, tasks, and notes, with secure user authentication.

## Features
- **Authentication**: Sign up with a username, email, and password; sign in to access a personalized dashboard.
- **Dashboard**: Displays a greeting with your username, upcoming classes, tasks, and notes (currently mock data).
- **Responsive Design**: Uses shadcn-ui components and Tailwind CSS for a modern, mobile-friendly UI.
- **Supabase Integration**: Stores user data (including username in `user_metadata`) and supports email confirmation.

## Prerequisites
- **Node.js**: Version 18 or 20.
- **npm**: Version 8 or higher (or Yarn/PNPM if preferred).
- **Supabase Account**: Create a project at [supabase.com](https://supabase.com).
- **Vercel Account**: For deployment (optional).
- **Docker**: For containerized development or deployment (optional).

## Setup
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/studese.git
   cd studese