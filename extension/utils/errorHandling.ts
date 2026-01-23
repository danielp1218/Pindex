/**
 * Centralized error handling utilities
 */

export interface AppError {
  message: string;
  code?: string;
  context?: Record<string, any>;
  originalError?: unknown;
}

export class PolyindexError extends Error {
  public readonly code?: string;
  public readonly context?: Record<string, any>;
  public readonly originalError?: unknown;

  constructor(message: string, options?: {
    code?: string;
    context?: Record<string, any>;
    originalError?: unknown;
  }) {
    super(message);
    this.name = 'PolyindexError';
    this.code = options?.code;
    this.context = options?.context;
    this.originalError = options?.originalError;
  }
}

/**
 * Safe error logging that handles unknown error types
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const errorInfo = normalizeError(error);
  
  console.group(`[Polyindex Error] ${errorInfo.message}`);
  
  if (errorInfo.code) {
    console.error('Code:', errorInfo.code);
  }
  
  if (context || errorInfo.context) {
    console.error('Context:', { ...errorInfo.context, ...context });
  }
  
  if (errorInfo.originalError) {
    console.error('Original Error:', errorInfo.originalError);
  }
  
  if (error instanceof Error && error.stack) {
    console.error('Stack:', error.stack);
  }
  
  console.groupEnd();
}

/**
 * Normalize unknown error types to consistent format
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof PolyindexError) {
    return {
      message: error.message,
      code: error.code,
      context: error.context,
      originalError: error.originalError,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name !== 'Error' ? error.name : undefined,
      originalError: error,
    };
  }
  
  if (typeof error === 'string') {
    return {
      message: error,
      originalError: error,
    };
  }
  
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return {
      message: error.message,
      originalError: error,
    };
  }
  
  return {
    message: 'An unknown error occurred',
    originalError: error,
  };
}

/**
 * Safe async operation wrapper with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  options?: {
    fallback?: T;
    onError?: (error: unknown) => void;
    context?: Record<string, any>;
  }
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logError(error, options?.context);
    
    if (options?.onError) {
      options.onError(error);
    }
    
    return options?.fallback;
  }
}

/**
 * Safe synchronous operation wrapper with error handling
 */
export function safeSync<T>(
  operation: () => T,
  options?: {
    fallback?: T;
    onError?: (error: unknown) => void;
    context?: Record<string, any>;
  }
): T | undefined {
  try {
    return operation();
  } catch (error) {
    logError(error, options?.context);
    
    if (options?.onError) {
      options.onError(error);
    }
    
    return options?.fallback;
  }
}

/**
 * Validates that a value is not null or undefined
 */
export function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new PolyindexError(message || 'Expected non-null value', {
      code: 'NULL_VALUE_ERROR',
    });
  }
}

/**
 * Creates a timeout promise that rejects after specified time
 */
export function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  message = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PolyindexError(message, {
        code: 'TIMEOUT_ERROR',
        context: { timeoutMs },
      }));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}