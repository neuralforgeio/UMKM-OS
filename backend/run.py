"""Development launcher.

Reads HOST, PORT and DEBUG from the environment (backend/.env) and starts
uvicorn accordingly — nothing is hard-coded on the command line:

    python run.py
"""

import uvicorn

from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",       # import string — required for reload mode
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
