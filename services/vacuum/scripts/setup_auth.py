"""
One-time Roborock authentication setup.

Run this once before starting the sidecar service:

    uv run python scripts/setup_auth.py

Authenticates against the Roborock cloud API and writes tokens to
data/auth_cache.json. After this the sidecar starts without any interaction.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from roborock import UserData
from roborock.exceptions import RoborockException
from roborock.web_api import RoborockApiClient

from services.auth_service import save_cache
from settings import settings


async def main() -> None:
    print(f"Authenticating as {settings.roborock_username} ...")
    client = RoborockApiClient(username=settings.roborock_username)
    password = settings.roborock_password.get_secret_value()

    user_data: UserData
    try:
        user_data = await client.pass_login(password)
    except RoborockException as e:
        if "2031" not in str(e):
            print(f"Login failed: {e}")
            sys.exit(1)
        print("Two-step verification required. Requesting code ...")
        await client.request_code()
        code = input("Enter the code sent to your email: ").strip()
        try:
            user_data = await client.code_login(code)
        except RoborockException as e2:
            print(f"Code login failed: {e2}")
            sys.exit(1)

    save_cache(user_data)
    print("Authentication successful. Tokens cached.")
    print("You can now start the sidecar: uv run app.py")


if __name__ == "__main__":
    asyncio.run(main())
