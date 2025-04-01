# Retrieval-Augmented Generation (RAG) Implementation

## Overview

This document describes how the Health App implements Retrieval-Augmented Generation (RAG) using LlamaIndex to efficiently find relevant health data when answering user questions.

## Problem Solved

Traditional approaches to providing AI with context would either:
1. Send ALL user health data to the AI (high token usage, potential context limit issues)
2. Only use pre-defined, generic responses (poor personalization)

Our RAG implementation solves these problems by:
1. Only retrieving the most semantically relevant health records for each query
2. Efficiently using context window space
3. Providing personalized responses based on specific health data points

## Implementation Architecture

The RAG system consists of these key components:

### 1. Data Processing (rag-processor.ts)
- Converts FHIR resources to text representations (`fhirResourceToText`)
- Creates LlamaIndex documents with appropriate metadata (`fhirResourcesToDocuments`)
- Sets up embedding models for vector search

### 2. Semantic Search (rag-service.ts)
- `findRelevantResources` function implements semantic search
- Takes a user query and finds semantically related health records
- Uses OpenAI's embedding model to create vector representations
- Returns only the top N most relevant resources, optimizing token usage

### 3. Question Handling (question/route.ts)
- Receives user questions through the API
- Uses `findRelevantResources` to get only relevant health data for the query
- Creates an optimized prompt with user profile, relevant records, and instruction context
- Sends this focused prompt to OpenAI for response generation

## Example Flow

1. User asks: "How's my iron?"
2. System retrieves all FHIR resources for the user
3. LlamaIndex converts these to vector embeddings
4. Semantic search finds resources related to iron/hemoglobin/blood tests
5. Only those relevant resources are included in the context
6. OpenAI receives a focused prompt with just the relevant information
7. Response is highly relevant and personalized to the user's actual health data

## Benefits

- **Efficiency**: Dramatically reduces token usage by only including relevant data
- **Better Responses**: More focused context leads to more relevant, accurate answers
- **Scalability**: Can handle users with large amounts of health data
- **Future-proof**: As users accumulate more health data over time, the system remains efficient

## Usage

The system is automatically used whenever a user asks a question in the chat interface. No special actions are required from the user to benefit from the RAG implementation. 