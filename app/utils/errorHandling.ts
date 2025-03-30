// Custom error types
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Error handler function
export const handleError = (error: unknown): { message: string; type: string } => {
  // Log all errors for debugging
  console.error('Error occurred:', error);

  if (error instanceof APIError) {
    return {
      message: error.message,
      type: 'api'
    };
  }

  if (error instanceof AuthError) {
    return {
      message: 'Authentication error. Please try logging in again.',
      type: 'auth'
    };
  }

  if (error instanceof ValidationError) {
    return {
      message: error.message,
      type: 'validation'
    };
  }

  // Handle unknown errors
  return {
    message: 'An unexpected error occurred. Please try again later.',
    type: 'unknown'
  };
};

// Function to format error messages for display
export const formatErrorMessage = (error: unknown): string => {
  const { message } = handleError(error);
  return message;
};

// Function to determine if an error should be reported to error tracking service
export const shouldReportError = (error: unknown): boolean => {
  if (error instanceof ValidationError) {
    return false; // Don't report validation errors
  }
  
  if (error instanceof APIError && error.status === 404) {
    return false; // Don't report 404 errors
  }

  return true;
};

// Function to extract error details for logging
export const getErrorDetails = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof APIError && {
        status: error.status,
        code: error.code
      })
    };
  }

  return {
    error
  };
}; 