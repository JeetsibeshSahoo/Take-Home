import jwt from 'jsonwebtoken';


// Authentication Middleware: Verifies Bearer JWT token from Authorization header.
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token required. Please log in.',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'swarn_sathi_secure_jwt_secret_dev_key_2026';
    const decoded = jwt.verify(token, secret);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token. Please log in again.',
    });
  }
}


// Role-Based Access Control (RBAC) Guard.
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
}