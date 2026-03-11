"""
Vercel serverless function entry point.
Wraps the FastAPI app from backend/main.py for the @vercel/python runtime.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import app  # noqa: E402
