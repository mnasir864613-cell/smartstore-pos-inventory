// Request validator utilities for SmartStore API

export const validateBody = (rules) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, config] of Object.entries(rules)) {
      const val = req.body[field];

      if (config.required && (val === undefined || val === null || val === '')) {
        errors.push(`'${field}' is required`);
        continue;
      }

      if (val !== undefined && val !== null && val !== '') {
        if (config.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) {
            errors.push(`'${field}' must be a valid number`);
          } else {
            if (config.min !== undefined && num < config.min) {
              errors.push(`'${field}' must be >= ${config.min}`);
            }
            if (config.max !== undefined && num > config.max) {
              errors.push(`'${field}' must be <= ${config.max}`);
            }
          }
        }

        if (config.type === 'string' && typeof val !== 'string') {
          errors.push(`'${field}' must be a string`);
        }

        if (config.type === 'array' && !Array.isArray(val)) {
          errors.push(`'${field}' must be an array`);
        } else if (config.type === 'array' && config.minLength && val.length < config.minLength) {
          errors.push(`'${field}' must contain at least ${config.minLength} item(s)`);
        }

        if (config.enum && !config.enum.includes(val)) {
          errors.push(`'${field}' must be one of: ${config.enum.join(', ')}`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Request payload validation failed',
        details: errors
      });
    }

    next();
  };
};
