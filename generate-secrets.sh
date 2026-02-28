#!/bin/bash

# ============================================
# Secret Key Generator for NIBSS Ticket Tracker
# ============================================
# This script generates secure random keys for your .env file

echo "=========================================="
echo "NIBSS Ticket Tracker - Secret Key Generator"
echo "=========================================="
echo ""

# Generate JWT Secret (64 characters)
echo "JWT_SECRET_KEY (64 characters):"
openssl rand -base64 48 | tr -d '\n'
echo ""
echo ""

# Generate API Key (32 characters)
echo "API_KEY (32 characters):"
openssl rand -hex 32 | tr -d '\n'
echo ""
echo ""

# Generate Webhook Secret (32 characters)
echo "WEBHOOK_SECRET (32 characters):"
openssl rand -hex 32 | tr -d '\n'
echo ""
echo ""

# Generate Session Secret (48 characters)
echo "SESSION_SECRET (48 characters):"
openssl rand -base64 36 | tr -d '\n'
echo ""
echo ""

echo "=========================================="
echo "Copy these values to your .env file"
echo "NEVER commit these to version control!"
echo "=========================================="
