#!/bin/bash

# Install LlamaIndex and related packages
npm install llamaindex @llamaindex/core @llamaindex/openai

# Install Headless UI for the settings component
npm install @headlessui/react

# Update package.json to include the new dependencies
echo "Packages installed successfully!"
echo "Please make sure to add the following to your package.json dependencies:"
echo "  \"@llamaindex/core\": \"^0.1.0\","
echo "  \"@llamaindex/openai\": \"^0.1.0\","
echo "  \"llamaindex\": \"^0.1.16\","
echo "  \"@headlessui/react\": \"^1.7.17\"" 