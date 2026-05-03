"""
Discovery POC — Roborock Saros 20X
Run: uv run --env-file .env python discover.py

Authenticates against the Roborock cloud API and dumps everything
python-roborock can see about your devices: device info, protocol version,
current status, room segments, and map availability. Used to validate
library compatibility with the Saros 20X before building the full sidecar.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import Any

from roborock.devices.device import RoborockDevice
from roborock.devices.device_manager import UserParams, create_device_manager
from roborock.exceptions import RoborockException, RoborockUnsupportedFeature
from roborock.web_api import RoborockApiClient

logging.basicConfig(level=logging.WARNING)


def _require(key: str) -> str:
    value = os.environ.get(key, "").strip()
    if not value:
        print(f"ERROR: {key} is not set.")
        print("Copy .env.example to .env, fill in your credentials, then:")
        print("  uv run --env-file .env python discover.py")
        sys.exit(1)
    return value


def _json(obj: Any) -> str:
    return json.dumps(obj, indent=2, default=str)


async def probe_device(device: RoborockDevice) -> None:
    print(f"\n{'─' * 60}")
    print(f"Device:   {device.name}")
    print(f"Serial:   {device.duid}")
    print(f"Product:  {device.product.name if device.product else 'unknown'}")
    print(
        f"Protocol: v1_properties={device.v1_properties is not None}"
        f"  b01_q10={device.b01_q10_properties is not None}"
        f"  b01_q7={device.b01_q7_properties is not None}"
    )

    # --- Wait for connection (discover_devices already called start_connect) ---
    print("\nWaiting for MQTT connection ...")
    ready = asyncio.Event()
    remove_cb = device.add_ready_callback(lambda _: ready.set())
    try:
        await asyncio.wait_for(ready.wait(), timeout=30.0)
    except TimeoutError:
        print("  Timed out after 30 s — MQTT session could not connect to Roborock cloud.")
        return
    finally:
        remove_cb()

    print(f"  connected={device.is_connected}  local={device.is_local_connected}")

    props = device.v1_properties
    if props is None:
        print(
            "\nNo v1_properties — device may use b01/a01 protocol (not yet handled in this POC)."
        )
        return

    # --- Status ---
    print("\nFetching status ...")
    try:
        await props.status.refresh()
        s = props.status
        print(f"  state:         {s.state_name} ({s.state})")
        print(f"  battery:       {s.battery}%")
        print(f"  fan_power:     {s.fan_speed_name} ({s.fan_power})")
        print(f"  mop_mode:      {s.water_mode_name} ({s.water_box_mode})")
        print(f"  error_code:    {s.error_code}")
        print(f"  in_cleaning:   {s.in_cleaning}")
        print(f"  fan_options:   {s.fan_speed_options}")
        print(f"  mop_options:   {s.water_mode_options}")
    except (RoborockException, RoborockUnsupportedFeature) as e:
        print(f"  status failed: {e}")

    # --- Rooms ---
    print("\nFetching rooms ...")
    try:
        await props.rooms.refresh()
        room_map = props.rooms.room_map
        if room_map:
            print(f"  {len(room_map)} segment(s) from device:")
            for seg_id, mapping in room_map.items():
                print(
                    f"    segment {seg_id} → iot_id {mapping.iot_id}: {mapping.name or '(unnamed)'}"
                )
        else:
            print("  No room segments returned (map may not be configured yet).")
    except (RoborockException, RoborockUnsupportedFeature) as e:
        print(f"  rooms failed: {e}")

    # --- Map ---
    print("\nFetching map ...")
    try:
        await props.maps.refresh()
        maps = props.maps
        print(f"  maps trait type: {type(maps).__name__}")
        print(f"  maps as_dict:    {_json(maps.as_dict())[:300]} ...")
    except (RoborockException, RoborockUnsupportedFeature) as e:
        print(f"  map failed: {e}")

    # --- Full diagnostic dump ---
    print("\nFull diagnostic dump:")
    try:
        diag = device.diagnostic_data()
        print(_json(diag)[:2000])
    except Exception as e:
        print(f"  dump failed: {e}")


async def main() -> None:
    username = _require("ROBOROCK_USERNAME")
    password = _require("ROBOROCK_PASSWORD")
    target_serial = os.environ.get("ROBOROCK_DEVICE_ID", "").strip() or None

    print(f"Authenticating as {username} ...")
    client = RoborockApiClient(username=username)
    try:
        user_data = await client.pass_login(password)
    except RoborockException as e:
        if "2031" not in str(e):
            print(f"Login failed: {e}")
            sys.exit(1)
        # Two-step verification required — request OTP sent to the account email.
        print("Two-step verification required. Requesting code ...")
        await client.request_code()
        code = input("Enter the code sent to your email: ").strip()
        try:
            user_data = await client.code_login(code)
        except RoborockException as e2:
            print(f"Code login failed: {e2}")
            sys.exit(1)

    print("Login OK.\n")

    user_params = UserParams(username=username, user_data=user_data)
    device_manager = await create_device_manager(user_params)

    devices: list[RoborockDevice] = await device_manager.discover_devices()
    print(f"Found {len(devices)} device(s).")

    if not devices:
        print("No devices found. Make sure the account has a paired device.")
        await device_manager.close()
        return

    if target_serial:
        targets = [d for d in devices if d.duid == target_serial]
        if not targets:
            serials = [d.duid for d in devices]
            print(f"Serial {target_serial!r} not found. Available: {serials}")
            await device_manager.close()
            sys.exit(1)
        devices = targets
    elif len(devices) > 1:
        print(
            "Multiple devices found — probing all. Set ROBOROCK_DEVICE_ID to target one."
        )

    for device in devices:
        await probe_device(device)

    await device_manager.close()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
