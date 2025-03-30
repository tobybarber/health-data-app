#!/bin/bash

# Script to set up the RAG environment properly

echo "Setting up RAG environment..."

# Install null-loader (needed for webpack config)
npm install --save-dev null-loader

# Install llamaindex packages as optional dependencies
npm install --save-optional llamaindex@0.1.16 @llamaindex/core@0.1.0 @llamaindex/openai@0.1.0

# Create directory for type declarations if it doesn't exist
mkdir -p types

echo "Setup complete! Restart your development server with:"
echo "npm run dev" 