"""
HeyGen Video Synthesis Toolkit

This toolkit provides capabilities to generate and control digital human videos 
using the HeyGen API framework. It allows the Longxia agents (like Creative Agent) 
to programmatically dispatch text-to-video jobs.
"""

import aiohttp
import asyncio
import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class HeyGenVideoToolkit:
    """
    Toolkit for generating digital human videos using HeyGen API.
    """
    
    def __init__(self):
        # API key should be injected from .env
        self.api_key = os.environ.get("HEYGEN_API_KEY", "")
        self.base_url = "https://api.heygen.com/v2"
        self.headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "x-api-key": self.api_key
        }

    async def generate_avatar_video(self, text: str, avatar_id: str = "default_avatar", voice_id: str = "default_voice") -> Dict[str, Any]:
        """
        Generate a video of an avatar speaking the provided text.
        
        Args:
            text: The speech text.
            avatar_id: The ID of the GenJi or selected avatar.
            voice_id: The voice ID for TTS synthesis.
            
        Returns:
            Dict containing the video task ID and status.
        """
        if not self.api_key:
            logger.warning("HEYGEN_API_KEY is missing. Operating in mock mode.")
            return {"status": "mock", "video_url": "mock_heygen_video.mp4"}

        endpoint = f"{self.base_url}/video/generate"
        payload = {
            "video_inputs": [
                {
                    "character": {
                        "type": "avatar",
                        "avatar_id": avatar_id,
                        "avatar_style": "normal"
                    },
                    "voice": {
                        "type": "text",
                        "input_text": text,
                        "voice_id": voice_id
                    }
                }
            ],
            "dimension": {
                "width": 1920,
                "height": 1080
            }
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, json=payload, headers=self.headers) as response:
                    response.raise_for_status()
                    data = await response.json()
                    return data
        except Exception as e:
            logger.error(f"Failed to generate HeyGen video: {e}")
            return {"error": str(e)}

    async def check_video_status(self, video_id: str) -> Dict[str, Any]:
        """
        Check the rendering status of a generated video.
        """
        endpoint = f"{self.base_url}/video.status.get"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params={"video_id": video_id}, headers=self.headers) as response:
                    response.raise_for_status()
                    return await response.json()
        except Exception as e:
            logger.error(f"Failed to check HeyGen video status: {e}")
            return {"error": str(e)}
