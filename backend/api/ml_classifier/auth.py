"""
Authentication and Rate Limiting for ML API

Provides JWT authentication and rate limiting middleware.
"""

from fastapi import HTTPException, Security, status, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Optional, Dict
import jwt
import time
import logging
from collections import defaultdict
from threading import Lock

logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = "your-secret-key-here"  # TODO: Move to environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 100  # requests per window
RATE_LIMIT_WINDOW = 60  # seconds

# Security scheme
security = HTTPBearer()


# ============================================================================
# JWT Authentication
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Create JWT access token.
    
    Args:
        data: Data to encode in token
        expires_delta: Token expiration time
    
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify JWT token.
    
    Args:
        credentials: HTTP authorization credentials
    
    Returns:
        Decoded token payload
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.utcnow().timestamp() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token_payload: dict = Security(verify_token)) -> str:
    """
    Get current user from token.
    
    Args:
        token_payload: Decoded token payload
    
    Returns:
        User identifier
    
    Raises:
        HTTPException: If user not found in token
    """
    user_id = token_payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user_id


# ============================================================================
# Rate Limiting
# ============================================================================

class RateLimiter:
    """
    Simple in-memory rate limiter.
    
    Tracks requests per client and enforces rate limits.
    """
    
    def __init__(self, requests: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW):
        """
        Initialize rate limiter.
        
        Args:
            requests: Maximum requests per window
            window: Time window in seconds
        """
        self.requests = requests
        self.window = window
        self.clients: Dict[str, list] = defaultdict(list)
        self.lock = Lock()
    
    def is_allowed(self, client_id: str) -> tuple[bool, Optional[int]]:
        """
        Check if client is allowed to make request.
        
        Args:
            client_id: Client identifier (IP or user ID)
        
        Returns:
            Tuple of (allowed, retry_after_seconds)
        """
        with self.lock:
            now = time.time()
            window_start = now - self.window
            
            # Get client's request history
            requests = self.clients[client_id]
            
            # Remove old requests outside window
            requests = [req_time for req_time in requests if req_time > window_start]
            self.clients[client_id] = requests
            
            # Check if limit exceeded
            if len(requests) >= self.requests:
                # Calculate retry after
                oldest_request = min(requests)
                retry_after = int(oldest_request + self.window - now) + 1
                return False, retry_after
            
            # Add current request
            requests.append(now)
            return True, None
    
    def get_remaining(self, client_id: str) -> int:
        """
        Get remaining requests for client.
        
        Args:
            client_id: Client identifier
        
        Returns:
            Number of remaining requests
        """
        with self.lock:
            now = time.time()
            window_start = now - self.window
            
            requests = self.clients.get(client_id, [])
            requests = [req_time for req_time in requests if req_time > window_start]
            
            return max(0, self.requests - len(requests))
    
    def reset(self, client_id: str):
        """
        Reset rate limit for client.
        
        Args:
            client_id: Client identifier
        """
        with self.lock:
            if client_id in self.clients:
                del self.clients[client_id]


# Global rate limiter instance
rate_limiter = RateLimiter()


async def check_rate_limit(request: Request):
    """
    Middleware to check rate limit.
    
    Args:
        request: FastAPI request
    
    Raises:
        HTTPException: If rate limit exceeded
    """
    # Get client identifier (IP address or user ID from token)
    client_id = request.client.host if request.client else "unknown"
    
    # Try to get user ID from authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                client_id = f"user:{user_id}"
        except:
            pass  # Use IP if token invalid
    
    # Check rate limit
    allowed, retry_after = rate_limiter.is_allowed(client_id)
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for client: {client_id}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(RATE_LIMIT_REQUESTS),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time()) + retry_after)
            }
        )
    
    # Add rate limit headers to response
    remaining = rate_limiter.get_remaining(client_id)
    request.state.rate_limit_remaining = remaining


def get_rate_limit_headers() -> dict:
    """
    Get rate limit headers for response.
    
    Returns:
        Dictionary of rate limit headers
    """
    return {
        "X-RateLimit-Limit": str(RATE_LIMIT_REQUESTS),
        "X-RateLimit-Window": str(RATE_LIMIT_WINDOW)
    }


# ============================================================================
# Optional Authentication (for development)
# ============================================================================

def optional_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(lambda: None)) -> Optional[str]:
    """
    Optional authentication for development.
    
    Args:
        credentials: HTTP authorization credentials (optional)
    
    Returns:
        User ID if authenticated, None otherwise
    """
    if credentials is None:
        return None
    
    try:
        payload = verify_token(credentials)
        return payload.get("sub")
    except HTTPException:
        return None
