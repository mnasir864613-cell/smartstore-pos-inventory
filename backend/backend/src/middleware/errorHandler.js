// Centralized error handling middleware

export const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log the full error server-side
  console.error('[Error Handler]', err);

  // PostgreSQL Unique Constraint Violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'ConflictError',
      message: 'A record with this identifier already exists',
      // Redact internal DB detail in production
      ...(isProduction ? {} : { detail: err.detail })
    });
  }

  // PostgreSQL Foreign Key Violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'ForeignKeyViolation',
      message: 'Referenced entity does not exist or cannot be modified/deleted due to related records',
      ...(isProduction ? {} : { detail: err.detail })
    });
  }

  // PostgreSQL Check Constraint Violation
  if (err.code === '23514') {
    return res.status(400).json({
      error: 'CheckConstraintViolation',
      message: 'Data violates database constraint',
      ...(isProduction ? {} : { detail: err.detail })
    });
  }

  // CORS error
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({
      error: 'CORSError',
      message: isProduction ? 'Cross-origin request blocked' : err.message
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.name || 'InternalServerError',
    // In production, hide internal error messages for 500-level errors
    message: (isProduction && status >= 500)
      ? 'An unexpected error occurred. Please try again later.'
      : (err.message || 'An unexpected error occurred')
  });
};
