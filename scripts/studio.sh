#!/bin/bash
# Load environment variables from .env.local
export $(cat .env.local | grep DATABASE_URL | xargs)
npx prisma studio --port 5555
